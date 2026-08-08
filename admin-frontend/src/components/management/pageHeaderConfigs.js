export const PAGE_HEADER_CONFIGS = Object.freeze({
  dashboard: {
    headingId: "pageTitle",
    image: "/images/dashboard.jpg",
    imagePosition: "center 30%",
    eyebrow: "Shelter Operations",
    title: "Command Center",
    description: "Monitor animal care, intake movement, adoption readiness, and shelter priorities from one coordinated view.",
    watermarkIcon: "bi-grid-1x2-fill",
    highlights: [
      { icon: "bi-activity", label: "Live shelter health" },
      { icon: "bi-arrow-left-right", label: "Workflow visibility" },
      { icon: "bi-shield-check", label: "Actionable priorities" }
    ],
    queue: { liveLabel: "Shelter desk active", label: "Priority queue", title: "Animals currently in intake", valueId: "heroIntakeCount", unit: "in intake" },
    actions: [{ href: "/pages/intakeList.html", icon: "bi-arrow-right", label: "Open intake queue" }],
    summaryLabel: "Shelter snapshot",
    metrics: [
      { id: "headerTotalPetsCount", icon: "bi-heart-pulse-fill", label: "Total Animals" },
      { id: "headerIntakeCount", icon: "bi-box-arrow-in-down", label: "In Intake", tone: "amber" },
      { id: "headerProfilingCount", icon: "bi-clipboard2-check-fill", label: "Profiling", tone: "blue" },
      { id: "headerQuarantineCount", icon: "bi-shield-plus", label: "Quarantine", tone: "rose" },
      { id: "headerReadyCount", icon: "bi-house-heart-fill", label: "Adoption Ready", tone: "green" },
      { id: "headerAdoptedCount", icon: "bi-balloon-heart-fill", label: "Adopted", tone: "rose" },
      { id: "headerArchivedCount", icon: "bi-archive-fill", label: "Archived", tone: "stone" }
    ]
  },
  intake: {
    headingId: "pageTitle",
    image: "/images/intake.jpg",
    imagePosition: "center 45%",
    eyebrow: "Animal Management",
    title: "Intake Management",
    description: "Review incoming cases, document animal condition, and move approved records into profiling and care monitoring.",
    watermarkIcon: "bi-heart-pulse-fill",
    highlights: [
      { icon: "bi-shield-check", label: "Role-based review" },
      { icon: "bi-arrow-repeat", label: "Guided conversion" },
      { icon: "bi-clipboard2-pulse", label: "Care-ready records" }
    ],
    queue: { liveLabel: "Intake desk active", label: "Priority queue", title: "Records awaiting review", valueId: "heroPendingCount", unit: "pending" },
    actions: [{ id: "btnNewIntake", icon: "bi-plus-lg", label: "Create Intake Record" }],
    summaryLabel: "Intake summary",
    metrics: [
      { id: "statAll", icon: "bi-inbox-fill", label: "Total Records" },
      { id: "statPending", icon: "bi-hourglass-split", label: "Pending Review", tone: "amber" },
      { id: "statApproved", icon: "bi-clipboard2-check-fill", label: "Approved", tone: "blue" },
      { id: "statConverted", icon: "bi-arrow-right-circle-fill", label: "Converted to Profile", tone: "green" },
      { id: "statRejected", icon: "bi-x-circle-fill", label: "Rejected", tone: "rose" }
    ]
  },
  surrenders: {
    headingId: "pageTitle",
    image: "/images/surrenders.jpg",
    imagePosition: "center 45%",
    eyebrow: "Animal Management",
    title: "Surrender Requests",
    description: "Review owner submissions, prioritize urgent cases, and guide approved animals into the intake workflow.",
    watermarkIcon: "bi-house-heart-fill",
    highlights: [
      { icon: "bi-shield-check", label: "Verified decisions" },
      { icon: "bi-stars", label: "Assisted classification" },
      { icon: "bi-arrow-right-circle", label: "Intake handoff" }
    ],
    queue: { liveLabel: "Review desk active", label: "Priority queue", title: "Requests awaiting review", valueId: "heroPendingCount", unit: "pending" },
    actions: [{ id: "reviewPendingBtn", icon: "bi-inbox", label: "Review pending requests" }],
    summaryLabel: "Surrender summary",
    metrics: [
      { id: "statTotal", icon: "bi-file-earmark-text-fill", label: "Total Requests" },
      { id: "statPending", icon: "bi-hourglass-split", label: "Pending Review", tone: "amber" },
      { id: "statCritical", icon: "bi-exclamation-triangle-fill", label: "Critical Urgency", tone: "rose" },
      { id: "statApproved", icon: "bi-check-circle-fill", label: "Approved", tone: "blue" },
      { id: "statConverted", icon: "bi-arrow-right-circle-fill", label: "Converted to Intake", tone: "green" },
      { id: "statRejected", icon: "bi-x-circle-fill", label: "Rejected", tone: "stone" }
    ]
  },
  animalProfiling: {
    image: "/images/animal-profiling.jpg",
    imagePosition: "center 45%",
    headingId: "pageTitle",
    eyebrow: "Animal Management",
    title: "Animal Profiling",
    description: "Complete shelter profiles, monitor care stages, and prepare animals for safe adoption through one coordinated workspace.",
    watermarkIcon: "bi-person-vcard-fill",
    highlights: [
      { icon: "bi-check2-circle", label: "Complete records" },
      { icon: "bi-heart-pulse", label: "Visible care stages" },
      { icon: "bi-shield-check", label: "Adoption-ready data" }
    ],
    queue: { liveLabel: "Profiling desk active", label: "Priority queue", title: "Profiles requiring completion", valueId: "heroProfilingCount", unit: "profiles" },
    actions: [{ href: "#animalRecords", icon: "bi-arrow-down", label: "Review profiling queue" }],
    summaryLabel: "Profiling summary",
    metrics: [
      { id: "statTotal", icon: "bi-heart-pulse-fill", label: "Total Animals" },
      { id: "statProfiling", icon: "bi-clipboard2-check-fill", label: "In Profiling", tone: "amber" },
      { id: "statQuarantine", icon: "bi-shield-plus", label: "Quarantine", tone: "blue" },
      { id: "statReady", icon: "bi-house-heart-fill", label: "Ready for Adoption", tone: "green" },
      { id: "statAdopted", icon: "bi-balloon-heart-fill", label: "Adopted", tone: "rose" },
      { id: "statArchived", icon: "bi-archive-fill", label: "Archived", tone: "stone" }
    ]
  },
  users: {
    image: "/images/user-management.jpg",
    imagePosition: "center 45%",
    headingId: "userManagementTitle",
    eyebrow: "System Administration",
    title: "User Management",
    description: "Keep the care team organized, review account health, and manage permissions from one reliable directory.",
    watermarkIcon: "bi-people-fill",
    highlights: [
      { icon: "bi-shield-check", label: "Role-based access" },
      { icon: "bi-person-check", label: "Account oversight" },
      { icon: "bi-key", label: "Controlled permissions" }
    ],
    queue: { liveLabel: "User directory active", label: "Review queue", title: "Inactive accounts requiring attention", valueId: "statInactive", unit: "accounts" },
    actions: [{ id: "btnAddUser", icon: "bi-person-plus-fill", label: "Add management user" }],
    summaryLabel: "Account summary",
    metrics: [
      { id: "statTotal", icon: "bi-people-fill", label: "Total Accounts" },
      { id: "statActiveDirectory", icon: "bi-person-check-fill", label: "Active Accounts", tone: "amber" },
      { id: "statAdmins", icon: "bi-shield-lock-fill", label: "Administrators", tone: "blue" },
      { id: "statStaff", icon: "bi-person-badge-fill", label: "Shelter Staff", tone: "green" },
      { id: "statVeterinarians", icon: "bi-heart-pulse-fill", label: "Veterinarians", tone: "rose" },
      { id: "statPublic", icon: "bi-globe2", label: "Public Users", tone: "stone" }
    ]
  },
  adoptions: {
    headingId: "pageTitle",
    image: "/images/adoptions.jpg",
    imagePosition: "center 15%",
    eyebrow: "Adoption Management",
    title: "Adoption Applications",
    description: "Review direct and AI-matched adoption requests, record decisions, and guide approved applicants to placement.",
    watermarkIcon: "bi-house-heart-fill",
    highlights: [
      { icon: "bi-person-check", label: "Applicant review" },
      { icon: "bi-cpu", label: "AI match insight" },
      { icon: "bi-balloon-heart", label: "Placement tracking" }
    ],
    queue: { liveLabel: "Adoption desk active", label: "Priority queue", title: "Applications awaiting review", valueId: "heroPendingCount", unit: "pending" },
    actions: [{ href: "#aaTablePanel", icon: "bi-inbox", label: "Review applications" }],
    summaryLabel: "Adoption summary",
    metrics: [
      { id: "statTotal", icon: "bi-file-earmark-heart-fill", label: "Total Applications" },
      { id: "statPending", icon: "bi-hourglass-split", label: "Pending Review", tone: "amber" },
      { id: "statApproved", icon: "bi-clipboard2-check-fill", label: "Approved", tone: "blue" },
      { id: "statFinalized", icon: "bi-balloon-heart-fill", label: "Finalized", tone: "green" },
      { id: "statRejected", icon: "bi-x-circle-fill", label: "Rejected", tone: "rose" },
      { id: "statQuizMatch", icon: "bi-cpu", label: "AI Quiz Match", tone: "stone" }
    ]
  },
  inventory: {
    image: "/images/inventory.jpg",
    imagePosition: "center 45%", 
    headingId: "pageTitle",
    eyebrow: "Resource Management",
    title: "Inventory Management",
    description: "Track shelter stock, monitor movement, and respond to critical restock needs from one reliable workspace.",
    watermarkIcon: "bi-boxes",
    highlights: [
      { icon: "bi-activity", label: "Live stock levels" },
      { icon: "bi-exclamation-triangle", label: "Restock alerts" },
      { icon: "bi-arrow-left-right", label: "Movement history" }
    ],
    queue: { liveLabel: "Inventory desk active", label: "Priority queue", title: "Items at critical stock", valueId: "heroCriticalCount", unit: "critical" },
    actions: [
      { id: "btnStockIn", icon: "bi-plus-lg", label: "Stock In" },
      { id: "btnRecordUsage", icon: "bi-dash-lg", label: "Record Usage", variant: "secondary" },
      { id: "btnAddItem", icon: "bi-box-seam", label: "Add Item", variant: "secondary" }
    ],
    summaryLabel: "Inventory summary",
    metrics: [
      { id: "statTotal", icon: "bi-boxes", label: "Total Items" },
      { id: "statCritical", icon: "bi-exclamation-triangle-fill", label: "Critical Stock", tone: "rose" },
      { id: "statLow", icon: "bi-arrow-down-circle-fill", label: "Low Stock", tone: "amber" },
      { id: "statFast", icon: "bi-activity", label: "Fast-Moving", tone: "green" }
    ]
  },
  announcements: {
    headingId: "pageTitle",
    image: "/images/announcements.jpg",
    imagePosition: "center 35%",
    eyebrow: "Community Engagement",
    title: "Announcements",
    description: "Publish trusted news and articles, celebrate success stories, and keep the community informed about upcoming events.",
    watermarkIcon: "bi-megaphone-fill",
    highlights: [
      { icon: "bi-newspaper", label: "News & articles" },
      { icon: "bi-heart", label: "Success stories" },
      { icon: "bi-calendar-event", label: "Upcoming events" }
    ],
    queue: { liveLabel: "Publisher active", label: "Editorial queue", title: "Draft posts awaiting publication", valueId: "heroDraftCount", unit: "drafts" },
    actions: [{ id: "btnNewAnnouncement", icon: "bi-plus-lg", label: "Create community post" }],
    summaryLabel: "Publishing summary",
    metrics: [
      { id: "announcementTotal", icon: "bi-megaphone-fill", label: "All Posts" },
      { id: "announcementPublished", icon: "bi-send-check-fill", label: "Published", tone: "green" },
      { id: "announcementDrafts", icon: "bi-pencil-square", label: "Drafts", tone: "amber" },
      { id: "announcementEvents", icon: "bi-calendar-event-fill", label: "Upcoming Events", tone: "blue" }
    ]
  },
  contactMessages: {
    headingId: "pageTitle",
    image: "/images/contact-messages.jpg",
    imagePosition: "center 85%",
    eyebrow: "Community Engagement",
    title: "Contact Messages",
    description: "Review public inquiries, keep responses organized, and send official ANIMUA replies from one coordinated inbox.",
    watermarkIcon: "bi-envelope-paper-fill",
    highlights: [
      { icon: "bi-inbox", label: "Centralized inquiries" },
      { icon: "bi-shield-check", label: "Role-protected access" },
      { icon: "bi-send-check", label: "Official email replies" }
    ],
    queue: {
      liveLabel: "Community inbox active",
      label: "Priority queue",
      title: "New messages awaiting a reply",
      valueId: "heroNewMessages",
      unit: "new"
    },
    actions: [
      { id: "refreshMessagesBtn", icon: "bi-arrow-clockwise", label: "Refresh messages" }
    ],
    summaryLabel: "Inbox summary",
    metrics: [
      { id: "totalMessages", icon: "bi-envelope-paper-fill", label: "All Messages" },
      { id: "newMessages", icon: "bi-envelope-exclamation-fill", label: "New Messages", tone: "amber" },
      { id: "repliedMessages", icon: "bi-send-check-fill", label: "Replied", tone: "green" }
    ]
  },
  reports: {
    headingId: "pageTitle",
    image: "/images/reports.jpg",
    imagePosition: "center 25%",
    eyebrow: "Operational Intelligence",
    title: "Reports Center",
    description: "Explore live shelter data, narrow records by date, and export reliable operational reports for review and planning.",
    watermarkIcon: "bi-bar-chart-fill",
    highlights: [
      { icon: "bi-database-check", label: "Live records" },
      { icon: "bi-geo-alt-fill", label: "Barangay intelligence" },
      { icon: "bi-file-earmark-arrow-down", label: "Ready to export" }
    ],
    queue: { liveLabel: "Reporting service active", label: "Current report", title: "Records in the selected view", valueId: "heroReportCount", unit: "records" },
    actions: [
      { id: "btnPrint", icon: "bi-printer-fill", label: "Print / PDF" },
      { id: "btnExcel", icon: "bi-file-earmark-excel-fill", label: "Export Excel", variant: "secondary" }
    ],
    summaryLabel: "Reporting snapshot",
    metrics: [
      { id: "reportSourceCount", icon: "bi-collection-fill", label: "Available Reports" },
      { id: "reportAllCount", icon: "bi-database-fill", label: "Live Records", tone: "blue" },
      { id: "reportVisibleCount", icon: "bi-funnel-fill", label: "Visible Records", tone: "amber" },
      { id: "reportGeneratedCount", icon: "bi-clock-history", label: "Generated Today", tone: "green", value: 1 }
    ]
  },
  auditTrail: {
    headingId: "pageTitle",
    image: "/images/audit-trail.jpg",
    imagePosition: "center 85%",  
    eyebrow: "System Governance",
    title: "Audit Trail",
    description: "Review staff actions, system events, and affected records with a clear, searchable history of administrative activity.",
    watermarkIcon: "bi-journal-check",
    highlights: [
      { icon: "bi-shield-lock", label: "Accountability built in" },
      { icon: "bi-search", label: "Traceable actions" },
      { icon: "bi-file-earmark-arrow-down", label: "Exportable logs" }
    ],
    queue: { liveLabel: "Audit monitor active", label: "Attention queue", title: "Warnings and failed events", valueId: "heroAuditAttention", unit: "events" },
    actions: [
      { id: "btnExportAudit", icon: "bi-download", label: "Export audit log" },
      { id: "btnResetFilters", icon: "bi-arrow-counterclockwise", label: "Reset filters", variant: "secondary" }
    ],
    summaryLabel: "Audit summary",
    metrics: [
      { id: "auditTotal", icon: "bi-journal-text", label: "All Events" },
      { id: "auditSuccess", icon: "bi-check-circle-fill", label: "Successful", tone: "green" },
      { id: "auditWarning", icon: "bi-exclamation-triangle-fill", label: "Warnings", tone: "amber" },
      { id: "auditFailed", icon: "bi-x-octagon-fill", label: "Failed", tone: "rose" }
    ]
  },
  archivedRecords: {
    headingId: "pageTitle",
    image: "/images/archived-records.jpg",
    imagePosition: "center 55%",
    eyebrow: "Records Governance",
    title: "Archived Records",
    description: "Review retained records across shelter modules, understand why they were archived, and restore eligible animal profiles safely.",
    watermarkIcon: "bi-archive-fill",
    highlights: [
      { icon: "bi-folder-check", label: "Centralized archive" },
      { icon: "bi-clock-history", label: "Clear record history" },
      { icon: "bi-arrow-clockwise", label: "Controlled restoration" }
    ],
    queue: { liveLabel: "Archive service active", label: "Current view", title: "Records matching your filters", valueId: "heroArchiveCount", unit: "records" },
    actions: [
      { id: "btnExportArchive", icon: "bi-download", label: "Export archive" },
      { id: "btnResetFilters", icon: "bi-arrow-counterclockwise", label: "Reset filters", variant: "secondary" }
    ],
    summaryLabel: "Archive summary",
    metrics: [
      { id: "archiveTotal", icon: "bi-archive-fill", label: "All Records" },
      { id: "archiveAnimals", icon: "bi-heart-pulse-fill", label: "Animal Records", tone: "green" },
      { id: "archiveAdoptions", icon: "bi-house-heart-fill", label: "Adoption Records", tone: "rose" },
      { id: "archiveInventory", icon: "bi-box-seam-fill", label: "Inventory Records", tone: "amber" },
      { id: "archiveUsers", icon: "bi-people-fill", label: "User Records", tone: "blue" }
    ]
  },
  accountSettings: {
    headingId: "pageTitle",
    image: "/images/account-settings.jpg",
    imagePosition: "center 45%",
    eyebrow: "Personal Workspace",
    title: "Account Settings",
    description: "Manage the identity shown across ANIMUA and keep your management account protected with clear, secure controls.",
    watermarkIcon: "bi-person-gear",
    highlights: [
      { icon: "bi-person-check", label: "Consistent identity" },
      { icon: "bi-shield-lock", label: "Protected credentials" },
      { icon: "bi-eye", label: "Clear account status" }
    ],
    queue: { liveLabel: "Protected session active", label: "Security standard", title: "Password requirements enabled", value: 5, unit: "rules" },
    actions: [
      { href: "#profileSettings", icon: "bi-person-badge", label: "Edit profile" },
      { href: "#securitySettings", icon: "bi-key", label: "Update password", variant: "secondary" }
    ],
    summaryLabel: "Account snapshot",
    metrics: [
      { id: "settingProfileStatus", icon: "bi-person-check-fill", label: "Profile Status", value: "Ready" },
      { id: "settingRole", icon: "bi-shield-check", label: "System Role", value: "Role", tone: "blue" },
      { id: "settingEmailStatus", icon: "bi-envelope-check-fill", label: "Email Status", value: "Managed", tone: "green" },
      { id: "settingSecurityScore", icon: "bi-lock-fill", label: "Security Rules", value: "5/5", tone: "amber" }
    ]
  }
});
