export const PAGE_HEADER_CONFIGS = Object.freeze({
  intake: {
    headingId: "pageTitle",
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
  }
});
