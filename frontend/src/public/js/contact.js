const openChatFromContact = document.getElementById("openChatFromContact");
const navbarChatbot = document.querySelector(".animua-chatbot-toggle");

if (openChatFromContact && navbarChatbot) {
  openChatFromContact.addEventListener("click", () => {
    navbarChatbot.click();
  });
}
