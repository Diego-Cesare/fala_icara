const heroSloganTop = document.getElementById("hero-slogan-top");
const heroSloganBottom = document.getElementById("hero-slogan-bottom");
const heroDescription = document.getElementById("description");
const openFormulary = document.getElementById("init");
const hero = document.getElementById("hero");

function animeSlogan() {
  if (!heroSloganTop || !heroSloganBottom) return;
  heroSloganTop.style.transform = "translateX(0px)";
  heroSloganBottom.style.transform = "translateX(0px)";
}

function animeDescription() {
  if (!heroDescription) return;
  heroDescription.style.opacity = "1";
}

function openForm() {
  if (!hero) {
    window.location.href = "formulary.html";
    return;
  }

  hero.style.transform = "translateX(-400px)";
  setTimeout(() => {
    window.location.href = "formulary.html";
  }, 1000);
}

openFormulary?.addEventListener("click", (e) => {
  e.preventDefault();
  openForm();
});

setTimeout(() => {
  animeSlogan();
}, 1000);

setTimeout(() => {
  animeDescription();
}, 1500);
