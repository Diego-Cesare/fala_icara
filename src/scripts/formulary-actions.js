const form = document.getElementById("report-form");
const downloadButton = document.querySelector(".action-download");
const shareButton = document.querySelector(".action-send");
const locationButton = document.getElementById("capture-location");
const locationStatus = document.getElementById("location-status");
const pdfStatus = document.getElementById("pdf-status");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");
const capturedAtInput = document.getElementById("location-captured-at");
const districtInput = document.getElementById("loc");
const streetInput = document.getElementById("street");
const LOCATION_FALLBACK_MESSAGE = "Preencha manualmente!";

let statusTimeoutId = null;

function showPdfStatus(message, isError = false) {
  if (!pdfStatus) return;

  pdfStatus.textContent = message;
  pdfStatus.classList.add("is-visible");
  pdfStatus.classList.toggle("is-error", isError);

  if (statusTimeoutId) clearTimeout(statusTimeoutId);
  statusTimeoutId = setTimeout(() => {
    pdfStatus.classList.remove("is-visible");
  }, 3200);
}

function updateLocationStatus(message, kind = "default") {
  if (!locationStatus) return;

  locationStatus.textContent = message;
  locationStatus.classList.remove("is-success", "is-error");

  if (kind === "success") locationStatus.classList.add("is-success");
  if (kind === "error") locationStatus.classList.add("is-error");
}

function setButtonBusy(button, busy, textWhenBusy) {
  if (!button) return;

  const label = button.querySelector("span");
  if (!label) return;

  if (busy) {
    button.dataset.originalLabel = label.textContent;
    button.disabled = true;
    label.textContent = textWhenBusy;
    return;
  }

  button.disabled = false;
  if (button.dataset.originalLabel) {
    label.textContent = button.dataset.originalLabel;
  }
}

function mapGeolocationError(error) {
  if (!error) return "Não foi possível capturar sua localização.";

  if (error.code === 1) return "Permissão de localização negada.";
  if (error.code === 2) return "Localização indisponível no momento.";
  if (error.code === 3) return "Tempo esgotado ao capturar localização.";
  return "Não foi possível capturar sua localização.";
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function setLocationFallbackOnEmptyFields() {
  if (districtInput && !districtInput.value.trim()) {
    districtInput.value = LOCATION_FALLBACK_MESSAGE;
  }
  if (streetInput && !streetInput.value.trim()) {
    streetInput.value = LOCATION_FALLBACK_MESSAGE;
  }
}

function setLocationFallbackOnBothFields() {
  if (districtInput) districtInput.value = LOCATION_FALLBACK_MESSAGE;
  if (streetInput) streetInput.value = LOCATION_FALLBACK_MESSAGE;
}

function getFirstAddressValue(address, keys) {
  for (const key of keys) {
    if (address[key]) return address[key];
  }
  return "";
}

function normalizeStreet(address) {
  const streetName = getFirstAddressValue(address, [
    "road",
    "pedestrian",
    "street",
    "residential",
    "path",
    "footway",
    "cycleway",
  ]);
  if (!streetName) return "";

  const number = address.house_number
    ? String(address.house_number).trim()
    : "";
  return number ? `${streetName}, ${number}` : streetName;
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude);
  url.searchParams.set("lon", longitude);
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error("Falha na geocodificação reversa.");
  }

  const payload = await response.json();
  return payload?.address ?? null;
}

let lastLocationRequest = 0;
async function captureUserLocation() {
  const now = Date.now();
  if (now - lastLocationRequest < 2000) return;
  lastLocationRequest = now;
  if (!navigator.geolocation) {
    updateLocationStatus("Seu navegador não suporta geolocalização.", "error");
    return;
  }

  if (locationButton) locationButton.disabled = true;
  updateLocationStatus("Capturando localização...", "default");

  let position = null;
  try {
    // Primeira tentativa: mais precisa (normalmente mais lenta no primeiro clique).
    position = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0,
    });
  } catch (firstError) {
    // Segunda tentativa automática no mesmo clique, com opções menos restritivas.
    if (firstError?.code === 2 || firstError?.code === 3) {
      try {
        updateLocationStatus(
          "Tentando novamente obter localização...",
          "default",
        );
        position = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        });
      } catch (secondError) {
        setLocationFallbackOnBothFields();
        updateLocationStatus(mapGeolocationError(secondError), "error");
        if (locationButton) locationButton.disabled = false;
        return;
      }
    } else {
      setLocationFallbackOnBothFields();
      updateLocationStatus(mapGeolocationError(firstError), "error");
      if (locationButton) locationButton.disabled = false;
      return;
    }
  }

  if (!position) {
    setLocationFallbackOnBothFields();
    updateLocationStatus("Não foi possível capturar sua localização.", "error");
    if (locationButton) locationButton.disabled = false;
    return;
  }

  const latitude = Number(position.coords.latitude).toFixed(6);
  const longitude = Number(position.coords.longitude).toFixed(6);

  if (latitudeInput) latitudeInput.value = latitude;
  if (longitudeInput) longitudeInput.value = longitude;
  if (capturedAtInput) capturedAtInput.value = new Date().toISOString();

  updateLocationStatus(
    "Localização capturada. Buscando endereço...",
    "default",
  );

  try {
    const address = await reverseGeocode(latitude, longitude);
    const district = address
      ? getFirstAddressValue(address, [
          "suburb",
          "neighbourhood",
          "quarter",
          "city_district",
          "borough",
          "hamlet",
          "village",
          "town",
          "city",
          "municipality",
          "county",
        ])
      : "";
    const street = address ? normalizeStreet(address) : "";

    if (districtInput && district) districtInput.value = district;
    if (streetInput && street) streetInput.value = street;

    if (district && street) {
      updateLocationStatus(
        "Localização capturada e endereço preenchido.",
        "success",
      );
    } else {
      setLocationFallbackOnEmptyFields();
      updateLocationStatus(
        "Localização capturada, mas não foi possível identificar bairro/rua.",
        "error",
      );
    }
  } catch {
    setLocationFallbackOnBothFields();
    updateLocationStatus(
      "Localização capturada, mas não foi possível preencher bairro e rua.",
      "error",
    );
  } finally {
    if (locationButton) locationButton.disabled = false;
  }
}

function toFileNameSafe(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getPdfFileName() {
  const districtValue =
    document.getElementById("loc")?.value?.trim() || "bairro";
  const safeDistrict = toFileNameSafe(districtValue) || "bairro";
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `conecta-icara-${safeDistrict}-${date}.pdf`;
}

function formatDateTime() {
  return new Date().toLocaleString("pt-BR");
}

function fileToJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível processar imagem."));
        return;
      }

      context.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem."));
    };

    img.src = objectUrl;
  });
}

async function collectSelectedImages() {
  const galleryFiles = window.formularyMedia?.getGalleryFiles?.() ?? [];
  const cameraFiles = window.formularyMedia?.getCameraFiles?.() ?? [];
  const allFiles = [
    ...galleryFiles.map((file) => ({ file, source: "Galeria" })),
    ...cameraFiles.map((file) => ({ file, source: "Câmera" })),
  ];

  const imageEntries = [];
  for (const entry of allFiles) {
    try {
      const dataUrl = await fileToJpegDataUrl(entry.file);
      imageEntries.push({
        dataUrl,
        source: entry.source,
        name: entry.file.name,
      });
    } catch {
      // Ignora imagens inválidas sem interromper a geração do PDF.
    }
  }

  return imageEntries;
}

function getFormDataSnapshot() {
  const value = (id) => document.getElementById(id)?.value?.trim() ?? "";

  return {
    name: value("name"),
    phone: value("phone"),
    district: value("loc"),
    street: value("street"),
    type: value("type"),
    description: value("desc"),
    latitude: value("latitude"),
    longitude: value("longitude"),
    capturedAt: value("location-captured-at"),
  };
}

function addSectionTitle(doc, state, title) {
  const { margin, width } = state;
  if (state.y + 10 > state.maxY) {
    doc.addPage();
    state.y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, margin, state.y);
  state.y += 2;

  doc.setDrawColor(210, 220, 222);
  doc.line(margin, state.y, width - margin, state.y);
  state.y += 5;
}

function addTextBlock(doc, state, label, value) {
  const safeValue = value || "-";
  const maxWidth = state.width - state.margin * 2;
  const line = `${label}: ${safeValue}`;
  const lines = doc.splitTextToSize(line, maxWidth);
  const blockHeight = lines.length * 5 + 1;

  if (state.y + blockHeight > state.maxY) {
    doc.addPage();
    state.y = state.margin;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(lines, state.margin, state.y);
  state.y += blockHeight;
}

function addMapLinkBlock(doc, state, latitude, longitude) {
  const hasCoordinates = Boolean(latitude && longitude);
  if (!hasCoordinates) {
    addTextBlock(doc, state, "Localização no mapa", "Não capturada.");
    return;
  }

  const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const label = "Localização no mapa: ";
  const linkText = "Abrir no Google Maps";

  const blockHeight = 6;
  if (state.y + blockHeight > state.maxY) {
    doc.addPage();
    state.y = state.margin;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 35, 37);
  doc.text(label, state.margin, state.y);

  const labelWidth = doc.getTextWidth(label);
  const linkX = state.margin + labelWidth;
  const linkY = state.y;
  const linkWidth = doc.getTextWidth(linkText);
  const linkHeight = 5;

  doc.setTextColor(8, 92, 164);
  doc.text(linkText, linkX, linkY);

  if (typeof doc.link === "function") {
    doc.link(linkX, linkY - 4.2, linkWidth, linkHeight, { url });
  } else if (typeof doc.textWithLink === "function") {
    doc.textWithLink(linkText, linkX, linkY, { url });
  }

  doc.setTextColor(20, 35, 37);
  state.y += blockHeight;
}

function addImageGrid(doc, state, images) {
  if (images.length === 0) {
    addTextBlock(doc, state, "Imagens", "Nenhuma imagem anexada.");
    return;
  }

  addSectionTitle(doc, state, "Imagens anexadas");

  const totalWidth = state.width - state.margin * 2;
  const cardWidth = Math.min(totalWidth, 190);
  const x = state.margin + (totalWidth - cardWidth) / 2;

  for (const image of images) {
    let imageHeight = 80;
    try {
      const imageProps = doc.getImageProperties(image.dataUrl);
      const ratio = imageProps.height / imageProps.width;
      imageHeight = Math.min(80, Math.max(36, (cardWidth - 4) * ratio));
    } catch {
      imageHeight = 80;
    }

    const caption = `${image.source} - ${image.name}`;
    const captionLines = doc.splitTextToSize(caption, cardWidth - 4);
    const captionHeight = Math.max(4, captionLines.length * 3.4);
    const cardHeight = imageHeight + captionHeight + 4;

    if (state.y + cardHeight > state.maxY) {
      doc.addPage();
      state.y = state.margin;
    }

    const y = state.y;

    doc.setFillColor(248, 252, 252);
    doc.setDrawColor(208, 221, 223);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
    doc.addImage(
      image.dataUrl,
      "JPEG",
      x + 2,
      y + 2,
      cardWidth - 4,
      imageHeight,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(captionLines.slice(0, 2), x + 2, y + imageHeight + 4.5);
    state.y += cardHeight + 3;
  }
}

async function buildPdfDocument() {
  if (!window.jspdf?.jsPDF) {
    throw new Error("jsPDF indisponível.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const state = {
    margin: 14,
    y: 18,
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
    maxY: doc.internal.pageSize.getHeight() - 14,
  };

  const data = getFormDataSnapshot();
  const images = await collectSelectedImages();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(`Registro de Ocorrência - ${data.district}`, state.margin, state.y);
  state.y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em: ${formatDateTime()}`, state.margin, state.y);
  state.y += 8;

  addSectionTitle(doc, state, "Dados do usuário");
  addTextBlock(doc, state, "Nome", data.name);
  addTextBlock(doc, state, "Telefone", data.phone);

  addSectionTitle(doc, state, "Local do problema");
  addTextBlock(doc, state, "Bairro", data.district);
  addTextBlock(doc, state, "Rua", data.street);
  addMapLinkBlock(doc, state, data.latitude, data.longitude);
  // addTextBlock(
  //   doc,
  //   state,
  //   "Data da captura da localização",
  //   data.capturedAt ? new Date(data.capturedAt).toLocaleString("pt-BR") : "-",
  // );

  addSectionTitle(doc, state, "Descrição");
  addTextBlock(doc, state, "Tipo", data.type);
  addTextBlock(doc, state, "Detalhes", data.description);

  addImageGrid(doc, state, images);

  return doc;
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

async function handleDownloadPdf() {
  if (!form?.reportValidity()) return;

  try {
    setButtonBusy(downloadButton, true, "Gerando...");
    const doc = await buildPdfDocument();
    doc.save(getPdfFileName());
    showPdfStatus("PDF gerado e baixado com sucesso.");
  } catch {
    showPdfStatus("Falha ao gerar o PDF.", true);
  } finally {
    setButtonBusy(downloadButton, false);
  }
}

async function handleSharePdf() {
  if (!form?.reportValidity()) return;

  try {
    setButtonBusy(shareButton, true, "Gerando...");
    const doc = await buildPdfDocument();
    const fileName = getPdfFileName();
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Ocorrência - Conecta Içara",
        text: "Segue o PDF da ocorrência registrada.",
        files: [file],
      });
      showPdfStatus("PDF compartilhado com sucesso.");
      return;
    }

    downloadBlob(blob, fileName);
    showPdfStatus("Compartilhamento indisponível. PDF baixado.", true);
  } catch (error) {
    if (error?.name === "AbortError") {
      showPdfStatus("Compartilhamento cancelado.");
      return;
    }
    showPdfStatus("Falha ao compartilhar o PDF.", true);
  } finally {
    setButtonBusy(shareButton, false);
  }
}

function resetLocationState() {
  if (latitudeInput) latitudeInput.value = "";
  if (longitudeInput) longitudeInput.value = "";
  if (capturedAtInput) capturedAtInput.value = "";
  updateLocationStatus("Localização não capturada.", "default");
}

locationButton?.addEventListener("click", captureUserLocation);
downloadButton?.addEventListener("click", handleDownloadPdf);
shareButton?.addEventListener("click", handleSharePdf);

form?.addEventListener("reset", () => {
  setTimeout(() => {
    resetLocationState();
    if (pdfStatus) pdfStatus.classList.remove("is-visible", "is-error");
  }, 0);
});
