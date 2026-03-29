const openChatFromContact = document.getElementById("openChatFromContact");
const navbarChatbot = document.querySelector(".chatbot-btn");

if (openChatFromContact && navbarChatbot) {
  openChatFromContact.addEventListener("click", () => {
    navbarChatbot.click();
  });
}
