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

let currentFilter = "all";
let currentPetForAdoption = null;

function mapPetFromBackend(pet) {
  const type =
  pet.species === "Canine" ? "dog" :
  pet.species === "Feline" ? "cat" :
  "other";

  return {
    id: pet.id,
    name: pet.name || "Unnamed Pet",
    type,
    age: pet.age ? `${pet.age} year${Number(pet.age) > 1 ? "s" : ""}` : "Unknown age",
    sex: pet.sex || "Unknown",
    size: pet.size || "Unknown",
    status: pet.status || "Ready for Adoption",
    traits: [],
    description: pet.distinctFeatures || "This rescued pet is looking for a loving home.",
    match: "Best for adopters ready to provide a safe, caring, and responsible home.",
    image:
      pet.photoUrl ||
      (type === "dog"
        ? "https://loremflickr.com/500/360/dog?lock=1001"
        : "https://loremflickr.com/500/360/cat?lock=1002"),
  };
}

const dogNames = [
  "Buddy", "Max", "Bruno", "Coco", "Rocky", "Milo", "Bingo", "Charlie", "Toby", "Simba",
  "Lucky", "Oreo", "Brownie", "Hunter", "Choco", "Sky", "Prince", "Pogi", "Bantay", "Yuki"
];

const catNames = [
  "Luna", "Mochi", "Nori", "Miso", "Peaches", "Mimi", "Clover", "Ash", "Willow", "Maple",
  "Tofu", "Sunny", "Panda", "Suki", "Snow", "Nina", "Olive", "Tiger", "Bibi", "Cali"
];

const dogPersonalities = [
  ["Friendly", "Playful", "Loyal"],
  ["Sweet", "Gentle", "Cuddly"],
  ["Active", "Curious", "Smart"],
  ["Calm", "Loving", "Quiet"],
  ["Energetic", "Happy", "Social"],
  ["Brave", "Affectionate", "Alert"],
  ["Cheerful", "People-Oriented", "Playful"],
  ["Gentle", "Easygoing", "Patient"],
  ["Lively", "Silly", "Warm"],
  ["Smart", "Trainable", "Loving"]
];

const catPersonalities = [
  ["Calm", "Sweet", "Gentle"],
  ["Curious", "Quiet", "Independent"],
  ["Affectionate", "Soft", "Friendly"],
  ["Playful", "Cute", "Alert"],
  ["Relaxed", "Loving", "Shy"],
  ["Gentle", "Indoor", "Quiet"],
  ["Snuggly", "Soft", "Warm"],
  ["Curious", "Smart", "Sweet"],
  ["Calm", "Observant", "Gentle"],
  ["Playful", "Friendly", "Light-Hearted"]
];

const dogDescriptions = [
  "A lovable companion who enjoys attention, warm company, and daily walks.",
  "Friendly and easy to bond with, perfect for adopters looking for a sweet dog.",
  "A playful dog who would thrive in a caring and active home environment.",
  "Calm and gentle, ideal for families or individuals wanting a loyal companion.",
  "An affectionate rescue who is ready for a fresh start and a forever home."
];

const catDescriptions = [
  "A gentle cat who enjoys calm spaces, soft naps, and kind human company.",
  "Quiet and affectionate, best for adopters looking for a peaceful indoor companion.",
  "A sweet rescue cat with a soft personality and a warm heart.",
  "Curious but gentle, this cat would do well in a loving and patient home.",
  "Calm and easygoing, perfect for adopters who want a relaxed feline friend."
];

function createDog(index) {
  return {
    id: `dog-${index + 1}`,
    name: dogNames[index],
    type: "dog",
    age: `${(index % 5) + 1} year${(index % 5) + 1 > 1 ? "s" : ""}`,
    sex: index % 2 === 0 ? "Male" : "Female",
    size: ["Small", "Medium", "Large"][index % 3],
    status: "Ready for Adoption",
    traits: dogPersonalities[index % dogPersonalities.length],
    description: dogDescriptions[index % dogDescriptions.length],
    match: "Best for adopters looking for a loving dog with a friendly and adaptable personality.",
    image: `https://loremflickr.com/500/360/dog?lock=${index + 1}`
  };
}

function createCat(index) {
  return {
    id: `cat-${index + 1}`,
    name: catNames[index],
    type: "cat",
    age: `${(index % 4) + 1} year${(index % 4) + 1 > 1 ? "s" : ""}`,
    sex: index % 2 === 0 ? "Female" : "Male",
    size: ["Small", "Medium"][index % 2],
    status: "Ready for Adoption",
    traits: catPersonalities[index % catPersonalities.length],
    description: catDescriptions[index % catDescriptions.length],
    match: "Best for adopters who want a gentle cat and a calm, nurturing home setup.",
    image: `https://loremflickr.com/500/360/cat?lock=${index + 31}`
  };
}

async function loadPublicPets() {
  try {
    const res = await fetch(`${API_BASE_URL}/public/pets`);

    if (!res.ok) {
      throw new Error("Failed to load public pets");
    }

    const data = await res.json();
    pets = data.map(mapPetFromBackend);
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

    try {
      const formData = {
        pet_name: petNameField.value,
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

loadPublicPets();;
