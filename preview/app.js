const contacts = [
  {
    name: "Mila Lenoir",
    email: "mila.lenoir@example.com",
    company: "NovaTech",
    status: "Qualification",
    lastActivity: "Appel le 09/04",
  },
  {
    name: "Yanis Perrin",
    email: "yanis.perrin@example.com",
    company: "Flowmatic",
    status: "Discovery",
    lastActivity: "Email envoyé le 08/04",
  },
  {
    name: "Sofia Charlier",
    email: "sofia.charlier@example.com",
    company: "Atlas Ventures",
    status: "Closing",
    lastActivity: "Démonstration prévue",
  },
  {
    name: "Louis Duret",
    email: "louis.duret@example.com",
    company: "Helio",
    status: "Nurturing",
    lastActivity: "Relance automatique",
  },
];

const timeline = [
  {
    date: "12 avr. 2024",
    title: "Rendez-vous découverte",
    details: "Compte rendu partagé, décision attendue semaine prochaine.",
  },
  {
    date: "06 avr. 2024",
    title: "Email Gmail",
    details: "Merci pour la présentation, Mila demande une simulation budgétaire.",
  },
  {
    date: "01 avr. 2024",
    title: "Création du contact",
    details: "Ajouté via import CSV NovaTech leads.",
  },
];

const opportunities = [
  {
    stage: "Discovery",
    title: "Refonte CRM Flowmatic",
    owner: "Mila Lenoir",
    value: "18 000€",
    due: "30 avr.",
  },
  {
    stage: "Qualification",
    title: "Migration Atlas Ventures",
    owner: "Sofia Charlier",
    value: "42 000€",
    due: "15 mai",
  },
  {
    stage: "Closing",
    title: "Upsell NovaTech",
    owner: "Yanis Perrin",
    value: "9 200€",
    due: "02 mai",
  },
];

const activities = [
  {
    due: "13 avr. — 10:30",
    type: "Réunion Google Meet",
    description: "Onboarding équipe support NovaTech",
  },
  {
    due: "14 avr. — 16:00",
    type: "Relance email",
    description: "Envoyer la grille tarifaire actualisée",
  },
  {
    due: "16 avr. — 09:15",
    type: "Tâche",
    description: "Préparer les slides du QBR Flowmatic",
  },
];

const emails = [
  {
    at: "10 avr. 09:14",
    subject: "Compte-rendu réunion",
    snippet: "Bonjour, voici le document demandé pour avancer sur l'intégration...",
  },
  {
    at: "09 avr. 17:01",
    subject: "Invitation Calendrier",
    snippet: "L'équipe marketing a ajouté Mila Lenoir à l'événement de lancement...",
  },
  {
    at: "07 avr. 11:23",
    subject: "Nouvelle opportunité",
    snippet: "Une opportunité Flowmatic a été créée automatiquement via webhook...",
  },
];

const importPreview = [
  { firstName: "Lena", lastName: "Coste", email: "lena.coste@example.com", company: "Helio" },
  { firstName: "Ibrahim", lastName: "Sow", email: "ibrahim.sow@example.com", company: "DataForge" },
  { firstName: "Tina", lastName: "Nguyen", email: "tina.nguyen@example.com", company: "NovaTech" },
];

const stages = ["Discovery", "Qualification", "Closing"];

const contactsTable = document.querySelector("#contacts-table");
const contactSearch = document.querySelector("#contact-search");
const timelineList = document.querySelector("#timeline");
const opportunitiesBoard = document.querySelector("#opportunities-board");
const activitiesList = document.querySelector("#activities-list");
const emailsList = document.querySelector("#emails-list");
const importPreviewContainer = document.querySelector("#import-preview");
const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");

function renderContacts(filter = "") {
  const rows = contacts
    .filter((contact) => contact.name.toLowerCase().includes(filter) || contact.email.toLowerCase().includes(filter))
    .map(
      (contact) => `
        <tr>
          <td>${contact.name}</td>
          <td>${contact.email}</td>
          <td>${contact.company}</td>
          <td><span class="badge-status">${contact.status}</span></td>
          <td>${contact.lastActivity}</td>
        </tr>
      `
    )
    .join("");
  contactsTable.innerHTML = rows || `<tr><td colspan="5">Aucun contact trouvé.</td></tr>`;
}

function renderTimeline() {
  timelineList.innerHTML = timeline
    .map(
      (item) => `
        <li>
          <time>${item.date}</time>
          <strong>${item.title}</strong>
          <p>${item.details}</p>
        </li>
      `
    )
    .join("");
}

function renderOpportunities() {
  const grouped = stages.map((stage) => ({ stage, items: opportunities.filter((op) => op.stage === stage) }));
  opportunitiesBoard.innerHTML = grouped
    .map(
      ({ stage, items }) => `
        <div class="column">
          <div class="column-header">
            <h2>${stage}</h2>
            <span class="pill">${items.length} deals</span>
          </div>
          ${
            items
              .map(
                (item) => `
                  <article class="card opportunity">
                    <h3>${item.title}</h3>
                    <p>Contact : ${item.owner}</p>
                    <p class="value">${item.value}</p>
                    <p>Echéance : ${item.due}</p>
                  </article>
                `
              )
              .join("") || `<p class="empty">Aucune opportunité</p>`
          }
        </div>
      `
    )
    .join("");
}

function renderActivities() {
  activitiesList.innerHTML = activities
    .map(
      (activity) => `
        <li class="list-item">
          <time>${activity.due}</time>
          <strong>${activity.type}</strong>
          <p>${activity.description}</p>
        </li>
      `
    )
    .join("");

  emailsList.innerHTML = emails
    .map(
      (email) => `
        <li class="list-item">
          <time>${email.at}</time>
          <strong>${email.subject}</strong>
          <p>${email.snippet}</p>
        </li>
      `
    )
    .join("");
}

function renderImportPreview() {
  importPreviewContainer.innerHTML = importPreview
    .map(
      (row, index) => `
        <div class="preview-card">
          <strong>Ligne ${index + 1}</strong>
          <p>${row.firstName} ${row.lastName}</p>
          <p>${row.email}</p>
          <p>${row.company}</p>
        </div>
      `
    )
    .join("");
}

function activatePanel(targetId) {
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
  navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.target === targetId));
}

contactSearch.addEventListener("input", (event) => {
  renderContacts(event.target.value.trim().toLowerCase());
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => activatePanel(button.dataset.target));
});

renderContacts();
renderTimeline();
renderOpportunities();
renderActivities();
renderImportPreview();
activatePanel("contacts");
