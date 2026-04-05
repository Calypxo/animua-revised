import { API_BASE_URL } from "../../utils/api.js";

const petsGrid = document.getElementById("petsGrid");
const resultsCount = document.getElementById("resultsCount");
const emptyState = document.getElementById("emptyState");
const petSearch = document.getElementById("petSearch");
const filterTabs = document.querySelectorAll(".filter-tab");

const profileModal = document.getElementById("profileModal");
const adoptModal = document.getElementById("adoptModal");

const profileImage = document.getElementById("profileImage");
const profileType = document.getElementById("profileType");
const profileName = document.getElementById("profileName");
const profileDescription = document.getElementById("profileDescription");
const profileAge = document.getElementById("profileAge");
const profileSex = document.getElementById("profileSex");
const profileSize = document.getElementById("profileSize");
const profileStatus = document.getElementById("profileStatus");
const profileTraits = document.getElementById("profileTraits");
const profileMatch = document.getElementById("profileMatch");
const profileAdoptBtn = document.getElementById("profileAdoptBtn");

const selectedPetName = document.getElementById("selectedPetName");
const petNameField = document.getElementById("petNameField");
const adoptionForm = document.getElementById("adoptionForm");
const formMessage = document.getElementById("formMessage");


console.log("find-furbabies.js loaded");
console.log("API_BASE_URL:", API_BASE_URL);
console.log("petsGrid:", petsGrid);
console.log("resultsCount:", resultsCount);
console.log("emptyState:", emptyState);

let currentFilter = "all";
let currentPetForAdoption = null;

function mapPetFromBackend(pet) {
  const rawSpecies = (pet.species || "").toLowerCase();
  const type =
  rawSpecies === "dog" || rawSpecies === "canine" ? "dog" :
  rawSpecies === "cat" || rawSpecies === "feline" ? "cat" :
  "other";

  return {
    id: pet.id,
    name: pet.name || "Unnamed Pet",
    type,
    age: pet.ageEstimate || "Unknown age",
    sex: pet.sex || "Unknown",
    size: pet.size || "Unknown",
    status: pet.status || "Ready for Adoption",
    traits: [],
    description: pet.initialCondition || "This rescued pet is looking for a loving home.",
    match: "Best for adopters ready to provide a safe, caring, and responsible home.",
    image:
    pet.photoURL ||
    (type === "dog"
      ? "https://loremflickr.com/500/360/dog?lock=1001"
      : type === "cat"
      ? "https://loremflickr.com/500/360/cat?lock=1002"
      : "https://loremflickr.com/500/360/animal?lock=1003"),
  };
}


async function loadPublicPets() {
  try {
    console.log("Loading public pets...");
    const res = await fetch(`${API_BASE_URL}/public/pets`);
    console.log("Response status:", res.status);

    if (!res.ok) {
      throw new Error("Failed to load public pets");
    }

    const data = await res.json();
    console.log("API data:", data);

    pets = (data.pets || []).map(mapPetFromBackend);
    console.log("Mapped pets:", pets);

    applyFilters();
  } catch (error) {
    console.error("Public pets load error:", error);
    resultsCount.textContent = "0 pets found";
    emptyState.classList.add("show");
  }
}

let pets = [];

function renderPets(list) {
  if (!petsGrid || !resultsCount || !emptyState) {
    return;
  }

  petsGrid.innerHTML = "";

  if (!list.length) {
    emptyState.classList.add("show");
    resultsCount.textContent = "0 pets found";
    return;
  }

  emptyState.classList.remove("show");
  resultsCount.textContent = `${list.length} pet${list.length > 1 ? "s" : ""} found`;

  list.forEach((pet, index) => {
    const card = document.createElement("div");
    card.className = "pet-card reveal";
    card.innerHTML = `
      <div class="pet-card-image">
        <img src="${pet.image}" alt="${pet.name}">
        <span class="pet-badge">${pet.type === "dog" ? "Dog" : "Cat"}</span>
      </div>
      <div class="pet-card-body">
        <div class="pet-card-top">
          <div>
            <h3>${pet.name}</h3>
          </div>
        </div>
        <p class="pet-meta">${pet.age} • ${pet.sex} • ${pet.size}</p>
        <p class="pet-description">${pet.description}</p>
        <div class="pet-traits">
          ${pet.traits.map((trait) => `<span class="trait-chip">${trait}</span>`).join("")}
        </div>
        <div class="pet-actions">
          <button class="btn secondary-btn view-profile-btn" data-id="${pet.id}">View Pet Profile</button>
          <button class="btn primary-btn adopt-btn" data-id="${pet.id}">Adopt Now</button>
        </div>
      </div>
    `;

    petsGrid.appendChild(card);

    setTimeout(() => {
      card.classList.add("show");
    }, index * 20);
  });

  attachCardEvents();
}

function attachCardEvents() {
  document.querySelectorAll(".view-profile-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const pet = pets.find((item) => item.id === button.dataset.id);
      if (pet) {
        openProfileModal(pet);
      }
    });
  });

  document.querySelectorAll(".adopt-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const pet = pets.find((item) => item.id === button.dataset.id);
      if (pet) {
        openAdoptModal(pet);
      }
    });
  });
}

function applyFilters() {
  if (!petSearch) {
    renderPets(pets);
    return;
  }

  const searchValue = petSearch.value.trim().toLowerCase();

  const filtered = pets.filter((pet) => {
    const matchesFilter = currentFilter === "all" || pet.type === currentFilter;
    const matchesSearch = pet.name.toLowerCase().includes(searchValue);
    return matchesFilter && matchesSearch;
  });

  renderPets(filtered);
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    applyFilters();
  });
});

if (petSearch) {
  petSearch.addEventListener("input", applyFilters);
}

function openProfileModal(pet) {
  if (!profileModal) {
    return;
  }

  currentPetForAdoption = pet;
  profileImage.src = pet.image;
  profileImage.alt = pet.name;
  profileType.textContent = pet.type === "dog" ? "Dog" : "Cat";
  profileName.textContent = pet.name;
  profileDescription.textContent = pet.description;
  profileAge.textContent = pet.age;
  profileSex.textContent = pet.sex;
  profileSize.textContent = pet.size;
  profileStatus.textContent = pet.status;
  profileMatch.textContent = pet.match;

  profileTraits.innerHTML = pet.traits
    .map((trait) => `<span class="trait-chip">${trait}</span>`)
    .join("");

  profileModal.classList.add("show");
  document.body.classList.add("menu-open");
}

function openAdoptModal(pet) {
  if (!adoptModal) {
    return;
  }

  currentPetForAdoption = pet;
  selectedPetName.textContent = `${pet.name} (${pet.type === "dog" ? "Dog" : "Cat"})`;
  petNameField.value = pet.name;
  formMessage.textContent = "";
  adoptModal.classList.add("show");
  document.body.classList.add("menu-open");
}

if (profileAdoptBtn) {
  profileAdoptBtn.addEventListener("click", () => {
    if (currentPetForAdoption && profileModal) {
      profileModal.classList.remove("show");
      openAdoptModal(currentPetForAdoption);
    }
  });
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const modalId = button.dataset.close;
    const modal = document.getElementById(modalId);

    if (modal) {
      modal.classList.remove("show");
    }

    if (
      (!profileModal || !profileModal.classList.contains("show")) &&
      (!adoptModal || !adoptModal.classList.contains("show"))
    ) {
      document.body.classList.remove("menu-open");
    }
  });
});

[profileModal, adoptModal].forEach((modal) => {
  if (!modal) {
    return;
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.remove("show");

      if (
        (!profileModal || !profileModal.classList.contains("show")) &&
        (!adoptModal || !adoptModal.classList.contains("show"))
      ) {
        document.body.classList.remove("menu-open");
      }
    }
  });
});

if (adoptionForm) {
  adoptionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentPetForAdoption?.id) {
      formMessage.textContent = "No pet selected for adoption.";
      formMessage.style.color = "red";
      return;
    }

    try {
      const formData = {
        pet_id: currentPetForAdoption?.id,
        pet_name: currentPetForAdoption?.name,
        full_name: document.getElementById("fullName").value,
        age: document.getElementById("age").value,
        birthdate: document.getElementById("birthdate").value,
        address: document.getElementById("address").value,
        civil_status: document.getElementById("civilStatus").value,
        gender: document.getElementById("gender").value,
        citizenship: document.getElementById("citizenship").value,
        contact_number: document.getElementById("contactNumber").value,
        occupation: document.getElementById("occupation").value,
        spouse_name: document.getElementById("spouseName").value,
        children_names: document.getElementById("childrenNames").value,
        why_adopt: document.getElementById("whyAdopt").value,
        visit_veterinarian: document.getElementById("visitVeterinarian").value,
        existing_pets: document.getElementById("existingPets").value,
        issued_day: document.getElementById("issuedDay").value,
        issued_month: document.getElementById("issuedMonth").value,
        issued_year: document.getElementById("issuedYear").value,
        signature_name: document.getElementById("signatureName").value,
      };

      const res = await fetch(`${API_BASE_URL}/adoptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error("Failed to submit adoption request");
      }

      const result = await res.json();

      formMessage.textContent = "Adoption request submitted successfully!";
      formMessage.style.color = "green";

      adoptionForm.reset();
    } catch (error) {
      console.error("Adoption submit error:", error);
      formMessage.textContent = "Failed to submit. Please try again.";
      formMessage.style.color = "red";
    }
  });
}

loadPublicPets();
