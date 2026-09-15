// Use the real page markup, styles, and responsive filter enhancement locally.
// No authentication, application data, or remote writes are needed.
function mountFilters(kind) {
  const surrender = kind === "surrender";
  const sources = {};
  const files = {
    page: `admin-frontend/pages/${surrender ? "surrenders" : "adoptionApplications"}.html`,
    script: "admin-frontend/src/components/management/responsiveFilters.js",
    base: "admin-frontend/src/css/adminDashboard.css",
    pageStyle: `admin-frontend/src/css/${surrender ? "surrenderRequests" : "adoptionApps"}.css`,
    tables: "admin-frontend/src/css/managementTables.css",
    queue: "admin-frontend/src/css/reviewQueueRecords.css",
    reference: "admin-frontend/src/css/recordsPanelReference.css",
    responsive: "admin-frontend/src/css/managementResponsive.css",
  };
  Object.entries(files).forEach(([key, path]) => cy.readFile(path).then(source => { sources[key] = source; }));
  cy.then(() => {
    const markup = sources.page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b[^>]*>/gi, "")
      .replace('class="loading ', 'class="management-consistent-ui ');
    const css = ["base", "pageStyle", "tables", "queue", "reference", "responsive"].map(key => sources[key]).join("\n");
    const script = sources.script.replace(/export function /g, "function ") + "\nenhanceResponsiveFilters();";
    cy.intercept("GET", "**/__review-filters.html", {
      headers: { "content-type": "text/html" },
      body: markup.replace("</head>", `<style>${css}</style></head>`).replace("</body>", `<script>${script}</script></body>`),
    });
    cy.visit("/__review-filters.html");
  });
}

for (const kind of ["surrender", "adoption"]) {
  describe(`${kind} filter layout`, () => {
    for (const width of [1440, 1920]) {
      it(`aligns search, dropdowns, and Clear at ${width}px`, () => {
        cy.viewport(width, 1000);
        mountFilters(kind);
        cy.get(".mrf-workspace").should("be.visible").within(() => {
          cy.get(".search-pill-sm, select, .mrf-fields > button").should($controls => {
            const rectangles = [...$controls].map(control => control.getBoundingClientRect());
            const bottom = rectangles[0].bottom;
            const top = rectangles[0].top;
            rectangles.forEach(rect => {
              expect(Math.abs(rect.bottom - bottom), "control bottom alignment").to.be.at.most(1);
              expect(Math.abs(rect.top - top), "control top alignment").to.be.at.most(1);
            });
          });
        });
        cy.get(".mrf-workspace").screenshot(`${kind}-filters-${width}`);
      });
    }

    it("keeps tablet filters contained and phone filters accessible", () => {
      cy.viewport(768, 1000);
      mountFilters(kind);
      cy.get(".mrf-workspace").should($workspace => {
        expect($workspace[0].scrollWidth).to.be.at.most($workspace[0].clientWidth + 1);
      });
      cy.viewport(390, 844);
      cy.get(".mrf-trigger").should("be.visible").click();
      cy.get(".mrf-panel select").first().should("be.visible").select(1);
      cy.get(".mrf-done").click();
      cy.get(".mrf-chip").should("be.visible");
      cy.get(".mrf-chip").click();
      cy.get(".mrf-chip").should("not.exist");
      cy.get(".mrf-workspace").screenshot(`${kind}-filters-mobile`);
    });
  });
}
