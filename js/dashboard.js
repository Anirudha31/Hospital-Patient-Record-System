// Redirect if not logged in
let currentUser = null;

//added for test branch

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location = "login.html";
  } else {
    currentUser = user;
    loadPatients();
  }
});

// Load patients for current user only
function loadPatients() {
  if (!currentUser) return;

  // Helper function to get date for sorting
  const getDate = (patient) => {
    try {
      if (patient.createdAt) {
        if (patient.createdAt.toDate) {
          return patient.createdAt.toDate().getTime();
        } else if (patient.createdAt instanceof Date) {
          return patient.createdAt.getTime();
        } else if (patient.createdAt.seconds) {
          return patient.createdAt.seconds * 1000;
        }
      }
    } catch (e) {
      console.warn("Error getting date:", e);
    }
    return 0;
  };

  // Helper function to process snapshot
  const processSnapshot = (snapshot) => {
    allPatients = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      allPatients.push({ id: doc.id, ...data });
    });
    // Sort by createdAt if available (newest first), otherwise by name
    allPatients.sort((a, b) => {
      const dateA = getDate(a);
      const dateB = getDate(b);
      if (dateA && dateB) {
        return dateB - dateA; // Newest first
      }
      if (dateA) return -1;
      if (dateB) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    renderPatients();
    updateStats();
  };

  // Try to load with orderBy, but fallback to without if index doesn't exist
  db.collection("patients")
    .where("userId", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(
      processSnapshot,
      err => {
        // If ordering fails (no index), try without orderBy
        console.warn("Ordered query failed, trying without orderBy:", err.message);
        db.collection("patients")
          .where("userId", "==", currentUser.uid)
          .onSnapshot(
            processSnapshot,
            err2 => {
              console.error("Error loading patients:", err2);
              showMessage("Error loading patients. Please refresh the page.", "error");
            }
          );
      }
    );
}

// Display patients + search filter
let allPatients = [];

function renderPatients(filter = "") {
  const list = document.getElementById("patientList");
  list.innerHTML = "";

  const filtered = allPatients.filter(p => {
    const searchTerm = filter.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchTerm) ||
      p.disease.toLowerCase().includes(searchTerm) ||
      (p.phone && p.phone.includes(searchTerm)) ||
      (p.email && p.email.toLowerCase().includes(searchTerm))
    );
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">
          <img src="src/img/empty.png" alt="No patients" class="empty-icon-img" style="height: 100px; width: 100px;">

        </div>
        <div class="empty-state-text">No patients found</div>
        <div class="empty-state-subtext">
        </div>
      </li>
    `;
    return;
  }

  filtered.forEach(p => {
    let date = "Unknown";
    try {
      if (p.createdAt) {
        const d = p.createdAt.toDate ? p.createdAt.toDate() : p.createdAt;
        date = formatDate(d);
      }
    } catch (e) {
      console.warn("Date parse error:", e);
    }

    list.innerHTML += `
      <li class="patient-card">
        <div class="patient-info">
          <div class="patient-name">${escapeHtml(p.name || "Unknown")}</div>
          <div class="patient-details">${escapeHtml(p.age || "N/A")} yrs • ${escapeHtml(p.disease || "N/A")}</div>
          ${p.phone ? `<div class="patient-details">📞 ${escapeHtml(p.phone)}</div>` : ""}
          <div class="patient-meta">Added: ${date}</div>
        </div>
        <div class="patient-actions">
          <button class="btn-icon btn-view" onclick="viewPatient('${p.id}')" title="View">
            <img src="src/icon/view.svg" alt="View" class="icon-img">
          </button>
          <button class="btn-icon btn-edit" onclick="editPatient('${p.id}')" title="Edit">
            <img src="src/icon/edit.svg" alt="Edit" class="icon-img">
          </button>
          <button class="btn-icon btn-delete" onclick="deletePatient('${p.id}')" title="Delete">
            <img src="src/icon/delete.svg" alt="Delete" class="icon-img">
          </button>
        </div>
      </li>
    `;
  });
}


// Format date
function formatDate(date) {
  if (!date) return "Unknown";
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Update statistics
function updateStats() {
  const totalPatients = allPatients.length;
  document.getElementById("totalPatients").textContent = totalPatients;
}

// Helper function to remove error styling
function removeFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.remove("error-field");
  }
}

// Helper function to add error styling
function addFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.add("error-field");
    field.focus();
  }
}

// Clear all field errors
function clearFieldErrors() {
  removeFieldError("patientName");
  removeFieldError("patientAge");
  removeFieldError("patientDisease");
  removeFieldError("patientPhone");
  removeFieldError("patientEmail");
  removeFieldError("editPatientName");
  removeFieldError("editPatientAge");
  removeFieldError("editPatientDisease");
  removeFieldError("editPatientPhone");
  removeFieldError("editPatientEmail");
}

// Add patient
document.getElementById("addPatientBtn")?.addEventListener("click", async () => {
  // Clear previous errors
  clearFieldErrors();

  const name = document.getElementById("patientName").value.trim();
  const age = document.getElementById("patientAge").value.trim();
  const disease = document.getElementById("patientDisease").value.trim();
  const phone = document.getElementById("patientPhone")?.value.trim() || "";
  const email = document.getElementById("patientEmail")?.value.trim() || "";
  const address = document.getElementById("patientAddress")?.value.trim() || "";
  const notes = document.getElementById("patientNotes")?.value.trim() || "";

  // Validation with specific error messages
  if (!name) {
    addFieldError("patientName");
    showToast("Please enter the patient's name.", "error");
    return;
  }

  if (!age) {
    addFieldError("patientAge");
    showToast("Please enter the patient's age.", "error");
    return;
  }

  if (isNaN(age) || age === "" || parseInt(age) < 0 || parseInt(age) > 150) {
    addFieldError("patientAge");
    showToast("Please enter a valid age between 0 and 150 years.", "error");
    return;
  }

  if (!disease) {
    addFieldError("patientDisease");
    showToast("Please enter the disease or symptoms.", "error");
    return;
  }

  if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
    addFieldError("patientPhone");
    showToast("Please enter a valid phone number (numbers, spaces, dashes, parentheses, or + sign only).", "error");
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    addFieldError("patientEmail");
    showToast("Please enter a valid email address (e.g., patient@example.com).", "error");
    return;
  }

  if (!currentUser) {
    showToast("You must be logged in to add patients. Please login again.", "error");
    setTimeout(() => {
      window.location = "login.html";
    }, 2000);
    return;
  }

  try {
    await db.collection("patients").add({
      name,
      age: parseInt(age),
      disease,
      phone,
      email,
      address,
      notes,
      userId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Clear form and errors
    document.getElementById("patientName").value = "";
    document.getElementById("patientAge").value = "";
    document.getElementById("patientDisease").value = "";
    if (document.getElementById("patientPhone")) document.getElementById("patientPhone").value = "";
    if (document.getElementById("patientEmail")) document.getElementById("patientEmail").value = "";
    if (document.getElementById("patientAddress")) document.getElementById("patientAddress").value = "";
    if (document.getElementById("patientNotes")) document.getElementById("patientNotes").value = "";
    clearFieldErrors();

    showToast("Patient added successfully!", "success");
  } catch (err) {
    console.error("Error adding patient:", err);
    showToast("Failed to add patient. Please check your connection and try again.", "error");
  }
});

// Edit patient
let editingPatientId = null;

async function editPatient(id) {
  const patient = allPatients.find(p => p.id === id);
  if (!patient) return;

  editingPatientId = id;

  // Populate edit form
  document.getElementById("editPatientName").value = patient.name || "";
  document.getElementById("editPatientAge").value = patient.age || "";
  document.getElementById("editPatientDisease").value = patient.disease || "";
  document.getElementById("editPatientPhone").value = patient.phone || "";
  document.getElementById("editPatientEmail").value = patient.email || "";
  document.getElementById("editPatientAddress").value = patient.address || "";
  document.getElementById("editPatientNotes").value = patient.notes || "";

  // Show modal
  document.getElementById("editModal").classList.add("active");
}

// Update patient
document.getElementById("updatePatientBtn")?.addEventListener("click", async () => {
  if (!editingPatientId) return;

  // Clear previous errors
  removeFieldError("editPatientName");
  removeFieldError("editPatientAge");
  removeFieldError("editPatientDisease");
  removeFieldError("editPatientPhone");
  removeFieldError("editPatientEmail");

  const name = document.getElementById("editPatientName").value.trim();
  const age = document.getElementById("editPatientAge").value.trim();
  const disease = document.getElementById("editPatientDisease").value.trim();
  const phone = document.getElementById("editPatientPhone").value.trim();
  const email = document.getElementById("editPatientEmail").value.trim();
  const address = document.getElementById("editPatientAddress").value.trim();
  const notes = document.getElementById("editPatientNotes").value.trim();

  // Validation with visual feedback
  if (!name) {
    addFieldError("editPatientName");
    showToast("Please enter the patient's name.", "error");
    return;
  }

  if (!age) {
    addFieldError("editPatientAge");
    showToast("Please enter the patient's age.", "error");
    return;
  }

  if (isNaN(age) || age === "" || parseInt(age) < 0 || parseInt(age) > 150) {
    addFieldError("editPatientAge");
    showToast("Please enter a valid age between 0 and 150 years.", "error");
    return;
  }

  if (!disease) {
    addFieldError("editPatientDisease");
    showToast("Please enter the disease or symptoms.", "error");
    return;
  }

  if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
    addFieldError("editPatientPhone");
    showToast("Please enter a valid phone number (numbers, spaces, dashes, parentheses, or + sign only).", "error");
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    addFieldError("editPatientEmail");
    showToast("Please enter a valid email address (e.g., patient@example.com).", "error");
    return;
  }

  try {
    await db.collection("patients").doc(editingPatientId).update({
      name,
      age: parseInt(age),
      disease,
      phone,
      email,
      address,
      notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeEditModal();
    showToast("Patient updated successfully!", "success");
  } catch (err) {
    console.error("Error updating patient:", err);
    showToast("Failed to update patient. Please check your connection and try again.", "error");
  }
});

// View patient details
async function viewPatient(id) {
  const patient = allPatients.find(p => p.id === id);
  if (!patient) return;

  let date = "Unknown";
  let time = "";
  let updatedDate = "Unknown";

  try {
    if (patient.createdAt) {
      const createdDate = patient.createdAt.toDate ? patient.createdAt.toDate() : patient.createdAt;
      if (createdDate instanceof Date) {
        date = createdDate.toLocaleDateString();
        time = createdDate.toLocaleTimeString();
      }
    }
    if (patient.updatedAt) {
      const updatedDateObj = patient.updatedAt.toDate ? patient.updatedAt.toDate() : patient.updatedAt;
      if (updatedDateObj instanceof Date) {
        updatedDate = updatedDateObj.toLocaleDateString();
      }
    }
  } catch (e) {
    console.warn("Error formatting dates:", e);
  }

  // Helper function to reset element styles
  const resetElementStyle = (element) => {
    element.style.color = "";
    element.style.fontStyle = "";
  };

  // Set patient name
  const nameElement = document.getElementById("viewPatientName");
  nameElement.textContent = escapeHtml(patient.name || "Unknown Patient");
  resetElementStyle(nameElement);

  // Set age
  const ageElement = document.getElementById("viewPatientAge");
  resetElementStyle(ageElement);
  if (patient.age) {
    ageElement.textContent = `${patient.age} ${patient.age === 1 ? 'year' : 'years'}`;
    ageElement.classList.remove("table-value-empty");
  } else {
    ageElement.textContent = "Not specified";
    ageElement.classList.add("table-value-empty");
  }

  // Set disease
  const diseaseElement = document.getElementById("viewPatientDisease");
  resetElementStyle(diseaseElement);
  diseaseElement.textContent = escapeHtml(patient.disease || "Not specified");
  if (!patient.disease) {
    diseaseElement.classList.add("table-value-empty");
  } else {
    diseaseElement.classList.remove("table-value-empty");
  }

  // Set phone with clickable link
  const phoneElement = document.getElementById("viewPatientPhone");
  resetElementStyle(phoneElement);
  phoneElement.classList.remove("table-value-empty");
  if (patient.phone && patient.phone.trim()) {
    phoneElement.innerHTML = `<a href="tel:${escapeHtml(patient.phone)}">${escapeHtml(patient.phone)}</a>`;
  } else {
    phoneElement.textContent = "Not provided";
    phoneElement.classList.add("table-value-empty");
  }

  // Set email with clickable link
  const emailElement = document.getElementById("viewPatientEmail");
  resetElementStyle(emailElement);
  emailElement.classList.remove("table-value-empty");
  if (patient.email && patient.email.trim()) {
    emailElement.innerHTML = `<a href="mailto:${escapeHtml(patient.email)}">${escapeHtml(patient.email)}</a>`;
  } else {
    emailElement.textContent = "Not provided";
    emailElement.classList.add("table-value-empty");
  }

  // Set address
  const addressElement = document.getElementById("viewPatientAddress");
  resetElementStyle(addressElement);
  addressElement.classList.remove("table-value-empty");
  if (patient.address && patient.address.trim()) {
    addressElement.textContent = escapeHtml(patient.address);
  } else {
    addressElement.textContent = "Not provided";
    addressElement.classList.add("table-value-empty");
  }

  // Set notes
  const notesElement = document.getElementById("viewPatientNotes");
  resetElementStyle(notesElement);
  notesElement.classList.remove("table-value-empty");
  if (patient.notes && patient.notes.trim()) {
    notesElement.textContent = escapeHtml(patient.notes);
  } else {
    notesElement.textContent = "No additional notes";
    notesElement.classList.add("table-value-empty");
  }

  // Set timestamps
  document.getElementById("viewPatientCreated").textContent = time ? `${date} at ${time}` : date;
  document.getElementById("viewPatientUpdated").textContent = updatedDate;

  document.getElementById("viewModal").classList.add("active");
}

// Delete patient - show confirmation modal
let deletePatientId = null;

function deletePatient(id) {
  const patient = allPatients.find(p => p.id === id);
  if (!patient) return;

  deletePatientId = id;
  const patientName = patient.name || "this patient";

  // Update modal message with patient name
  document.getElementById("deleteModalMessage").textContent =
    `Are you sure you want to delete the record for "${patientName}"? This action cannot be undone.`;

  // Show delete modal
  document.getElementById("deleteModalBackdrop").classList.add("show");
  document.getElementById("deleteModal").classList.add("show");
}

// Confirm delete
async function confirmDelete() {
  if (!deletePatientId) return;

  const id = deletePatientId;
  deletePatientId = null;

  // Hide modal
  hideDeleteModal();

  try {
    await db.collection("patients").doc(id).delete();
    showToast("Patient deleted successfully!", "success");
  } catch (err) {
    console.error("Error deleting patient:", err);
    showToast("Failed to delete patient. Please try again.", "error");
  }
}

// Cancel delete
function cancelDelete() {
  deletePatientId = null;
  hideDeleteModal();
}

// Hide delete modal
function hideDeleteModal() {
  document.getElementById("deleteModalBackdrop").classList.remove("show");
  document.getElementById("deleteModal").classList.remove("show");
}

// Delete modal event listeners
document.getElementById("deleteModalConfirm")?.addEventListener("click", confirmDelete);
document.getElementById("deleteModalCancel")?.addEventListener("click", cancelDelete);

// Close delete modal on backdrop click
document.getElementById("deleteModalBackdrop")?.addEventListener("click", (e) => {
  if (e.target.id === "deleteModalBackdrop") {
    cancelDelete();
  }
});

// Close delete modal on Escape key (updated handler)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Close delete modal if open
    if (deletePatientId) {
      cancelDelete();
      e.preventDefault();
      return;
    }
    // Close edit modal if open
    if (editingPatientId) {
      closeEditModal();
      e.preventDefault();
      return;
    }
    // Close view modal if open
    const viewModal = document.getElementById("viewModal");
    if (viewModal && viewModal.classList.contains("active")) {
      closeViewModal();
      e.preventDefault();
    }
  }
});

// Close modals
function closeEditModal() {
  document.getElementById("editModal").classList.remove("active");
  editingPatientId = null;
}

function closeViewModal() {
  document.getElementById("viewModal").classList.remove("active");
}

// Modal close buttons
document.getElementById("editModalClose")?.addEventListener("click", closeEditModal);
document.getElementById("viewModalClose")?.addEventListener("click", closeViewModal);

// Close modal on background click
document.getElementById("editModal")?.addEventListener("click", (e) => {
  if (e.target.id === "editModal") closeEditModal();
});

document.getElementById("viewModal")?.addEventListener("click", (e) => {
  if (e.target.id === "viewModal") closeViewModal();
});


// 🔍 Search bar live filter
document.getElementById("searchPatient")?.addEventListener("input", e => {
  renderPatients(e.target.value);
});

// Clear error styling when user starts typing
document.getElementById("patientName")?.addEventListener("input", () => {
  removeFieldError("patientName");
});

document.getElementById("patientAge")?.addEventListener("input", () => {
  removeFieldError("patientAge");
});

document.getElementById("patientDisease")?.addEventListener("input", () => {
  removeFieldError("patientDisease");
});

document.getElementById("patientPhone")?.addEventListener("input", () => {
  removeFieldError("patientPhone");
});

document.getElementById("patientEmail")?.addEventListener("input", () => {
  removeFieldError("patientEmail");
});

// Clear error styling when user starts typing (Edit form)
document.getElementById("editPatientName")?.addEventListener("input", () => {
  removeFieldError("editPatientName");
});

document.getElementById("editPatientAge")?.addEventListener("input", () => {
  removeFieldError("editPatientAge");
});

document.getElementById("editPatientDisease")?.addEventListener("input", () => {
  removeFieldError("editPatientDisease");
});

document.getElementById("editPatientPhone")?.addEventListener("input", () => {
  removeFieldError("editPatientPhone");
});

document.getElementById("editPatientEmail")?.addEventListener("input", () => {
  removeFieldError("editPatientEmail");
});

// Enter key support for add patient form
document.getElementById("patientNotes")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    document.getElementById("addPatientBtn").click();
  }
});

document.getElementById("patientName")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("patientAge").focus();
  }
});

document.getElementById("patientAge")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("patientDisease").focus();
  }
});

document.getElementById("patientDisease")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (document.getElementById("patientPhone")) {
      document.getElementById("patientPhone").focus();
    } else {
      document.getElementById("addPatientBtn").click();
    }
  }
});

// 🌙 Dark mode toggle
const darkToggle = document.getElementById("darkModeToggle");
darkToggle?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  darkToggle.textContent = isDark ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("darkMode", isDark ? "on" : "off");
});

// Keep dark mode saved
if (localStorage.getItem("darkMode") === "on") {
  document.body.classList.add("dark");
  if (darkToggle) darkToggle.textContent = "☀️ Light";
}

// Show toast notification
function showToast(message, type = "success") {
  const toast = document.getElementById("toastNotification");
  const backdrop = document.getElementById("toastBackdrop");
  const toastMessage = toast.querySelector(".toast-message");
  const toastIcon = toast.querySelector(".toast-icon");
  const toastClose = toast.querySelector(".toast-close");

  // Set message
  toastMessage.textContent = message;

  // Set icon based on type
  if (type === "success") {
    toastIcon.textContent = "✅";
  } else if (type === "error") {
    toastIcon.textContent = "❌";
  } else {
    toastIcon.textContent = "ℹ️";
  }

  // Remove previous classes and add new type
  toast.classList.remove("success", "error", "info");
  toast.classList.add(type);

  // Show backdrop and toast
  backdrop.classList.add("show");
  toast.classList.add("show");

  // Auto-hide after 5 seconds
  const autoHide = setTimeout(() => {
    hideToast();
  }, 5000);

  // Close button handler
  toastClose.onclick = () => {
    clearTimeout(autoHide);
    hideToast();
  };

  // Close on backdrop click
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      clearTimeout(autoHide);
      hideToast();
    }
  };

  // Also update form message area
  const formMsg = document.getElementById("addPatientMsg");
  if (formMsg) {
    formMsg.textContent = message;
    formMsg.className = `muted-sm msg ${type}`;
    formMsg.style.display = "block";

    setTimeout(() => {
      formMsg.style.opacity = "0";
      formMsg.style.transition = "opacity 0.3s";
      setTimeout(() => {
        formMsg.textContent = "";
        formMsg.className = "muted-sm";
        formMsg.style.display = "none";
        formMsg.style.opacity = "1";
      }, 300);
    }, 5000);
  }
}

// Hide toast notification
function hideToast() {
  const toast = document.getElementById("toastNotification");
  const backdrop = document.getElementById("toastBackdrop");
  toast.classList.remove("show");
  backdrop.classList.remove("show");
}

// Show message (legacy function - now uses toast)
function showMessage(text, type = "success") {
  showToast(text, type);
}
