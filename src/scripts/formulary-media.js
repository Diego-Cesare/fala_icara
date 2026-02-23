const MAX_TOTAL_FILES = 2;
const CAN_SYNC_FILES = typeof DataTransfer !== "undefined";

const galleryInput = document.getElementById("gallery-input");
const cameraInput = document.getElementById("camera-input");
const galleryTrigger = document.getElementById("gallery-trigger");
const cameraTrigger = document.getElementById("camera-trigger");
const galleryCount = document.getElementById("gallery-count");
const cameraCount = document.getElementById("camera-count");
const totalCount = document.getElementById("total-count");
const preview = document.getElementById("media-preview");

const mediaState = {
  gallery: [],
  camera: [],
  previewUrls: [],
};

function revokePreviewUrls() {
  mediaState.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  mediaState.previewUrls = [];
}

function syncInputFiles(input, files) {
  if (!CAN_SYNC_FILES || !input) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

function isDuplicate(fileList, nextFile) {
  return fileList.some(
    (file) =>
      file.name === nextFile.name &&
      file.size === nextFile.size &&
      file.lastModified === nextFile.lastModified,
  );
}

function getTotalFilesCount() {
  return mediaState.gallery.length + mediaState.camera.length;
}

function getAllSelectedFiles() {
  return [...mediaState.gallery, ...mediaState.camera];
}

function updateCounters() {
  if (galleryCount) {
    galleryCount.textContent = `Galeria ${mediaState.gallery.length}`;
  }
  if (cameraCount) {
    cameraCount.textContent = `Câmera ${mediaState.camera.length}`;
  }
  if (totalCount) {
    totalCount.textContent = `Total ${getTotalFilesCount()}/${MAX_TOTAL_FILES}`;
  }
}

function renderEmptyState() {
  if (!preview) return;
  preview.innerHTML = '<p class="media-empty">Nenhuma imagem adicionada.</p>';
}

function createPreviewCard(file, sourceLabel) {
  const figure = document.createElement("figure");
  figure.className = "media-thumb";

  const image = document.createElement("img");
  const imageUrl = URL.createObjectURL(file);
  mediaState.previewUrls.push(imageUrl);
  image.src = imageUrl;
  image.alt = `Pré-visualização de ${file.name}`;

  const source = document.createElement("p");
  source.className = "media-source";
  source.textContent = sourceLabel;

  const caption = document.createElement("figcaption");
  caption.textContent = file.name;

  figure.appendChild(image);
  figure.appendChild(source);
  figure.appendChild(caption);
  return figure;
}

function renderPreview() {
  if (!preview) return;

  revokePreviewUrls();
  preview.innerHTML = "";

  const allFiles = [
    ...mediaState.gallery.map((file) => ({ file, source: "Galeria" })),
    ...mediaState.camera.map((file) => ({ file, source: "Câmera" })),
  ];

  if (allFiles.length === 0) {
    renderEmptyState();
    return;
  }

  allFiles.forEach((entry) => {
    preview.appendChild(createPreviewCard(entry.file, entry.source));
  });
}

function handleSourceInput(sourceKey, input) {
  if (!input) return;

  const incomingFiles = Array.from(input.files).filter((file) =>
    file.type.startsWith("image/"),
  );

  if (CAN_SYNC_FILES) {
    const allSelectedFiles = getAllSelectedFiles();
    incomingFiles.forEach((file) => {
      if (getTotalFilesCount() >= MAX_TOTAL_FILES) return;
      if (isDuplicate(allSelectedFiles, file)) return;
      mediaState[sourceKey].push(file);
      allSelectedFiles.push(file);
    });
    syncInputFiles(input, mediaState[sourceKey]);
    input.value = "";
  } else {
    const otherSourceKey = sourceKey === "gallery" ? "camera" : "gallery";
    const availableSlots = Math.max(0, MAX_TOTAL_FILES - mediaState[otherSourceKey].length);
    mediaState[sourceKey] = incomingFiles.slice(0, availableSlots);
  }

  updateCounters();
  renderPreview();
}

function clearMediaState() {
  revokePreviewUrls();
  mediaState.gallery = [];
  mediaState.camera = [];
  if (galleryInput) galleryInput.value = "";
  if (cameraInput) cameraInput.value = "";
  updateCounters();
  renderEmptyState();
}

galleryTrigger?.addEventListener("click", () => galleryInput?.click());
cameraTrigger?.addEventListener("click", () => cameraInput?.click());
galleryInput?.addEventListener("change", () => handleSourceInput("gallery", galleryInput));
cameraInput?.addEventListener("change", () => handleSourceInput("camera", cameraInput));

window.formularyMedia = {
  getGalleryFiles() {
    return [...mediaState.gallery];
  },
  getCameraFiles() {
    return [...mediaState.camera];
  },
};

updateCounters();
renderPreview();

document.getElementById("report-form")?.addEventListener("reset", () => {
  // Aguarda o reset nativo dos campos antes de limpar a UI de preview.
  setTimeout(() => {
    clearMediaState();
  }, 0);
});
