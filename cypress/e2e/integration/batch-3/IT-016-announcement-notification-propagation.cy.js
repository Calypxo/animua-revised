const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const ANNOUNCEMENT_ID = "FT_ANNOUNCEMENT_DRAFT";

describe("IT-016 — Announcement Notification Propagation", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "Public", "PublicNotifications"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: "announcements", token: tokens.Admin })
        .then((response) => {
          const announcement = (response.body?.announcements || []).find(
            ({ id }) => id === ANNOUNCEMENT_ID,
          );
          expect(announcement).to.include({ status: "Draft", visibleToPublic: false });
          return apiRequest({ path: "auth/account", token: tokens.PublicNotifications });
        })
        .then((response) => {
          expect(response.body?.account?.notificationSettings?.announcementsEvents).to.equal(true);
          return apiRequest({ path: "announcements/public" });
        })
        .then((response) => {
          expect(
            (response.body?.announcements || []).some(({ id }) => id === ANNOUNCEMENT_ID),
          ).to.equal(false);
        });
    },
  });

  it("publishes the controlled event and notifies each enabled public user exactly once", () => {
    let preferenceAccount;
    let updateResponse;
    let published;
    let publicAnnouncement;
    let enabledNotifications;
    let disabledNotifications;
    let ledgerResult;
    let announcementAudits;
    let preferenceAudits;

    apiRequest({ path: "auth/account", token: context.tokens.PublicNotifications })
      .then((response) => {
        preferenceAccount = response.body?.account;
        expect(preferenceAccount.notificationSettings.announcementsEvents).to.equal(true);
        return apiRequest({
          method: "PATCH",
          path: "auth/account/profile",
          token: context.tokens.PublicNotifications,
          body: {
            fullName: preferenceAccount.fullName,
            notificationPreference: "2 notification categories enabled",
            notificationSettings: {
              applicationUpdates: true,
              surrenderRequestUpdates: true,
              announcementsEvents: false,
            },
          },
        });
      })
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body?.account?.notificationSettings?.announcementsEvents).to.equal(false);
      });

    apiRequest({ path: "announcements", token: context.tokens.Admin }).then((response) => {
      const draft = (response.body?.announcements || []).find(({ id }) => id === ANNOUNCEMENT_ID);
      expect(draft).to.include({
        type: "Upcoming Events",
        status: "Draft",
        visibleToPublic: false,
      });
      return apiRequest({
        method: "PUT",
        path: `announcements/${ANNOUNCEMENT_ID}`,
        token: context.tokens.Admin,
        body: {
          title: draft.title,
          type: draft.type,
          caption: draft.caption,
          eventDate: draft.eventDate,
          location: draft.location || "Angeles City Veterinary Office",
          status: "Published",
          visibleToPublic: true,
        },
      }).then((response) => {
        updateResponse = response;
        return registerMutation({
          kind: "announcementPublish",
          primaryId: ANNOUNCEMENT_ID,
        }).then((result) => { ledgerResult = result; });
      });
    });

    apiRequest({ path: "announcements", token: context.tokens.Admin }).then((response) => {
      published = (response.body?.announcements || []).find(({ id }) => id === ANNOUNCEMENT_ID);
    });
    apiRequest({ path: "announcements/public" }).then((response) => {
      publicAnnouncement = (response.body?.announcements || []).find(
        ({ id }) => id === ANNOUNCEMENT_ID,
      );
    });
    apiRequest({ path: "notifications", token: context.tokens.Public }).then((response) => {
      enabledNotifications = (response.body?.notifications || []).filter(
        ({ referenceId, type }) =>
          referenceId === ANNOUNCEMENT_ID && type === "event_announcement",
      );
    });
    apiRequest({ path: "notifications", token: context.tokens.PublicNotifications })
      .then((response) => {
        disabledNotifications = (response.body?.notifications || []).filter(
          ({ referenceId, type }) =>
            referenceId === ANNOUNCEMENT_ID && type === "event_announcement",
        );
      });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      announcementAudits = logs.filter(
        (log) => log.rawAction === "announcement.updated" && log.record === ANNOUNCEMENT_ID,
      );
      preferenceAudits = logs.filter(
        (log) => log.rawAction === "account.profile_updated" &&
          log.record === context.emails.PublicNotifications &&
          log.after?.notificationSettings?.announcementsEvents === false,
      );
    });

    cy.then(() => {
      expect(updateResponse?.status).to.equal(200);
      expect(published).to.include({
        id: ANNOUNCEMENT_ID,
        status: "Published",
        visibleToPublic: true,
        type: "Upcoming Events",
      });
      expect(publicAnnouncement).to.include({
        id: ANNOUNCEMENT_ID,
        title: published.title,
        type: "Upcoming Events",
      });
      expect(enabledNotifications).to.have.length(1);
      expect(enabledNotifications[0]).to.deep.include({
        category: "event",
        type: "event_announcement",
        referenceId: ANNOUNCEMENT_ID,
      });
      expect(disabledNotifications).to.have.length(0);
      expect(ledgerResult.notificationCount).to.equal(7);
      expect(
        ledgerResult.registeredPaths.filter((path) => path.startsWith("notifications/")),
      ).to.have.length(7);
      expect(announcementAudits).to.have.length(1);
      expect(announcementAudits[0].after).to.deep.include({
        status: "Published",
        visibleToPublic: true,
      });
      expect(preferenceAudits).to.have.length(1);
      expect(preferenceAudits[0].after.notificationSettings.announcementsEvents).to.equal(false);
      expect(
        ledgerResult.registeredPaths.filter((path) => path.startsWith("auditLogs/")),
      ).to.have.length(2);
    });
  });
});
