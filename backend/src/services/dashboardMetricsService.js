const INACTIVE_ANIMAL_STATUSES = new Set(["Adopted", "Archived"]);

function getCurrentAnimalProfiles(animals = []) {
  return animals.filter(
    (animal) => !INACTIVE_ANIMAL_STATUSES.has(String(animal?.status || ""))
  );
}

module.exports = {
  getCurrentAnimalProfiles,
};
