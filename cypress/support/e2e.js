import "./commands";

Cypress.on("window:before:load", (window) => {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: null,
      addEventListener() {},
      getRegistration: () => Promise.resolve(null),
      getRegistrations: () => Promise.resolve([]),
      register: () =>
        Promise.resolve({
          waiting: null,
          installing: null,
          addEventListener() {},
          update: () => Promise.resolve(),
        }),
    },
  });
});
