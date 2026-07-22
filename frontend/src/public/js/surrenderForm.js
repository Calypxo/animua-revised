const SUBMIT_SURRENDER_API_URL =
  "http://localhost:5000/api/surrenders";

function getFormValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

const ANGELES_BARANGAYS = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
  "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur Este",
  "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
  "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
  "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
  "Tabun", "Virgen Delos Remedios",
];

function isValidAngelesBarangay(barangay) {
  return ANGELES_BARANGAYS.includes(barangay);
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(input => input.value);
}

function generateRequestId() {
  const timestamp = Date.now().toString().slice(-6);
  return `SR-2026-${timestamp}`;
}

/* LOGIN HELPERS */
function getLoggedInUser() {
  const isLoggedIn = localStorage.getItem("is_logged_in");
  const token = localStorage.getItem("animua_token");
  const name = localStorage.getItem("user_name");
  const email = localStorage.getItem("user_email");
  const role = localStorage.getItem("user_role");

  if (isLoggedIn !== "true" || !token) {
    return null;
  }

  return {
    token,
    name,
    email,
    role,
  };
}

function fillOwnerInfoFromAccount() {
  const user = getLoggedInUser();

  console.log("Logged in user for surrender form:", user);

  if (!user) {
    return;
  }

  const ownerNameInput = document.getElementById("ownerName");
  const ownerEmailInput = document.getElementById("ownerEmail");

  console.log("Owner name input:", ownerNameInput);
  console.log("Owner email input:", ownerEmailInput);

  if (ownerNameInput) {
    ownerNameInput.value = user.name || "";
    ownerNameInput.readOnly = true;
    ownerNameInput.classList.add("readonly-account-field");
  }

  if (ownerEmailInput) {
    ownerEmailInput.value = user.email || "";
    ownerEmailInput.readOnly = true;
    ownerEmailInput.classList.add("readonly-account-field");
  }
}

function openLoginModal() {
  const authModal = document.getElementById("authModal");

  if (authModal) {
    authModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    return;
  }

  localStorage.setItem("animua_open_auth_modal", "true");
  window.location.href = "/pages/public/home.html";
}

function requireLoggedInUser() {
  const user = getLoggedInUser();

  if (!user) {
    openLoginModal();
    return null;
  }

  return user;
}

async function submitSurrenderRequest(requestData) {
  const token = localStorage.getItem("animua_token");

  const response = await fetch(SUBMIT_SURRENDER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to submit surrender request.");
  }

  return data;
}

function showSuccessMessage(requestId) {
  alert(
    `Surrender request submitted successfully.\n\n` +
    `Request ID: ${requestId}\n` +
    `Status: Pending Review`
  );
}

function showErrorMessage() {
  alert(
    "Failed to submit surrender request. Please make sure the Python sentiment service is running."
  );
}

async function handleSurrenderSubmit(event) {
  event.preventDefault();

  const loggedInUser = requireLoggedInUser();

  if (!loggedInUser) {
    return;
  }

  const reason = getFormValue("reasons");

  if (!reason) {
    alert("Please enter your reason for surrendering.");
    return;
  }

  const barangay = getFormValue("ownerBarangay");

  if (!barangay) {
    alert("Please select your barangay in Angeles City.");
    return;
  }

  if (!isValidAngelesBarangay(barangay)) {
    alert("Only residents of Angeles City can submit a surrender request.");
    return;
  }

  const agreeAllTerms = document.getElementById("agreeAllTerms")?.checked || false;

  if (!agreeAllTerms) {
    alert("Please confirm that you have read and agree to the surrender terms.");
    return;
  }

  try {
    const requestId = generateRequestId();

    const surrenderRequest = {
      id: requestId,

      account: {
        name: loggedInUser.name,
        email: loggedInUser.email,
        role: loggedInUser.role,
      },

      status: "Pending",
      submittedAt: new Date().toISOString().split("T")[0],

      owner: {
        name: loggedInUser.name || getFormValue("ownerName"),
        contact: getFormValue("contactNo"),
        email: loggedInUser.email || getFormValue("ownerEmail"),
        address: getFormValue("ownerAddress"),
        barangay: barangay,
        city: "Angeles City",
        isAngelesResident: true,
      },

      pet: {
        name: getFormValue("petName"),
        species: getFormValue("species"),
        breed: getFormValue("breed"),
        age: getFormValue("petAge"),
        sex: getFormValue("petSex"),
        colorMarkings: getFormValue("colorMarkings"),
        status: getCheckedValues("status"),
        vaccinationHistory: getFormValue("vaccinationHistory"),
      },

      surrenderReason: reason,

      agreement: {
        agreedToTerms: agreeAllTerms,
        agreedAt: new Date().toISOString(),
        agreementText:
          "Nabasa ko at sumasang-ayon ako sa lahat ng mga tuntunin at pahayag na nakasaad sa itaas.",
      },

      nlp: null,
    };

    const result = await submitSurrenderRequest(surrenderRequest);

    showSuccessMessage(result.request.id);

    document.getElementById("surrenderForm").reset();
    fillOwnerInfoFromAccount();

  } catch (error) {
    console.error("Surrender submit error:", error);
    showErrorMessage();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fillOwnerInfoFromAccount();

  const surrenderForm = document.getElementById("surrenderForm");

  if (surrenderForm) {
    surrenderForm.addEventListener("submit", handleSurrenderSubmit);
  }
});