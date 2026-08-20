const {
  apiRequest,
  useIntegrationBaseline,
} = require("../../../support/integration");

function adminResultIds(token) {
  return apiRequest({ path: "match/admin/results?limit=1000", token }).then((response) => {
    expect(response.status).to.equal(200);
    return (response.body?.results || []).map(({ id }) => id).sort();
  });
}

describe("IT-018 — Node-to-Python Compatibility Contract", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin"],
    verifyRestored({ tokens }) {
      return adminResultIds(tokens.Admin).then((ids) => {
        expect(ids).to.deep.equal([
          "FT_QUIZ_RESULT_COOLDOWN",
          "FT_QUIZ_RESULT_ELIGIBLE",
        ]);
      });
    },
  });

  it("uses one real Python HTTP scoring request without creating persistent records", () => {
    let resultIdsBefore;
    let probe;
    let resultIdsAfter;

    adminResultIds(context.tokens.Admin).then((ids) => {
      resultIdsBefore = ids;
      return cy.exec("node backend/scripts/itCompatibilityProbe.js", { timeout: 30000 });
    }).then(({ stdout }) => {
      probe = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
      return adminResultIds(context.tokens.Admin);
    }).then((ids) => {
      resultIdsAfter = ids;
    });

    cy.then(() => {
      expect(probe.configuredUrl).to.equal("http://127.0.0.1:8001/score");
      expect(probe.httpCalls).to.have.length(1);
      expect(probe.httpCalls[0]).to.deep.include({
        url: probe.configuredUrl,
        method: "POST",
        status: 200,
      });
      expect(probe.httpCalls[0].requestBody).to.deep.equal({
        preferences: probe.preferences,
        animals: probe.animals,
        top_k: 3,
      });
      expect(probe.result).to.deep.equal(probe.httpCalls[0].responseBody);
      expect(probe.result.engine).to.equal("python");
      expect(probe.logs.warn).to.deep.equal([]);
      expect(probe.logs.info).to.deep.equal([
        "[matchPets] Python matcher used successfully.",
      ]);

      const matches = probe.result.matches;
      expect(matches.map(({ id }) => id)).to.deep.equal([
        "IT018-EXACT",
        "IT018-CLOSE",
        "IT018-FAR",
      ]);
      expect(matches[0]).to.include({ matchScore: 1, matchPercent: 100 });
      expect(matches).to.satisfy((items) => items.every((match, index) => {
        const source = probe.animals.find(({ id }) => id === match.id);
        return source &&
          match.name === source.name &&
          Number.isFinite(match.matchScore) &&
          Number.isFinite(match.matchPercent) &&
          (index === 0 || items[index - 1].matchScore >= match.matchScore);
      }));
      expect(resultIdsAfter, "compatibility persistence unchanged").to.deep.equal(resultIdsBefore);
    });
  });
});
