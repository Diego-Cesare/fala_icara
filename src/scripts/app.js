// ================= CONFIGURAÇÕES =================
const CONFIG = {
    EMAILJS_PUBLIC_KEY: 'cVEeTAPWCWxVNoU_H',
    EMAILJS_SERVICE_ID: 'service_xi26o83',
    EMAILJS_TEMPLATE_ID: 'template_4gyqkkj',
    RECIPIENT_EMAIL: 'diegocesare300491@gmail.com',

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: 'dpfcq3izl',
    CLOUDINARY_UPLOAD_PRESET: 'falaicara'
};

// ================= MENSAGENS =================
const MESSAGES = {
    success: 'Ocorrência enviada com sucesso! Obrigado pela contribuição.',
    error: 'Erro ao enviar. Tente novamente em alguns instantes.',
    sending: 'Enviando sua ocorrência...',
    uploadingImage: 'Enviando imagem...',
    geolocating: 'Obtendo sua localização...',
    geolocateSuccess: 'Localização obtida com sucesso!',
    geolocateError: 'Não foi possível obter sua localização.'
};

// ================= PREVIEW DA FOTO =================
function setupPhotoPreview() {
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImg');
    const removePhotoBtn = document.getElementById('removePhotoBtn');

    photoInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            previewImg.src = ev.target.result;
            photoPreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });

    removePhotoBtn.addEventListener('click', e => {
        e.preventDefault();
        photoInput.value = '';
        previewImg.src = '';
        photoPreview.style.display = 'none';
    });
}

// ================= GEOLOCALIZAÇÃO =================
function getGeolocation() {
    const locationInput = document.getElementById('location');
    const geoBtn = document.getElementById('geolocateBtn');

    if (!navigator.geolocation) {
        showFeedback('Geolocalização não suportada', 'error');
        return;
    }

    geoBtn.disabled = true;
    showFeedback(MESSAGES.geolocating, 'info');

    navigator.geolocation.getCurrentPosition(
        async pos => {
            const { latitude, longitude } = pos.coords;
            locationInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            geoBtn.disabled = false;
            showFeedback(MESSAGES.geolocateSuccess, 'success');
        },
        err => {
            geoBtn.disabled = false;
            showFeedback(MESSAGES.geolocateError, 'error');
            console.error(err);
        }
    );
}

// ================= FEEDBACK =================
function showFeedback(message, type = 'success') {
    const el = document.getElementById('feedback');
    el.textContent = message;
    el.className = `feedback feedback-${type}`;
    el.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => el.style.display = 'none', 5000);
    }
}

// ================= UPLOAD CLOUDINARY =================
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
    );

    if (!res.ok) throw new Error('Erro no upload da imagem');
    const data = await res.json();
    return data.secure_url;
}

// ================= FORM DATA =================
async function getFormData() {
    const data = {
        issue_type: document.getElementById('issue-type').value,
        description: document.getElementById('description').value,
        location: document.getElementById('location').value,
        to_email: CONFIG.RECIPIENT_EMAIL,
        photo_url: ''
    };

    const photoInput = document.getElementById('photo');
    if (photoInput.files && photoInput.files[0]) {
        showFeedback(MESSAGES.uploadingImage, 'info');
        data.photo_url = await uploadImage(photoInput.files[0]);
    }

    return data;
}

// ================= ENVIO EMAILJS =================
async function sendForm(formData) {
    showFeedback(MESSAGES.sending, 'info');
    const res = await emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID,
        CONFIG.EMAILJS_TEMPLATE_ID,
        formData
    );
    return res.status === 200;
}

// ================= INIT =================
function initForm() {
    emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);

    const form = document.getElementById('reportForm');
    const submitBtn = form.querySelector('.btn-submit');
    const geoBtn = document.getElementById('geolocateBtn');

    setupPhotoPreview();

    geoBtn.addEventListener('click', e => {
        e.preventDefault();
        getGeolocation();
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            const data = await getFormData();
            const ok = await sendForm(data);

            if (ok) {
                showFeedback(MESSAGES.success, 'success');
                form.reset();
            } else {
                showFeedback(MESSAGES.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showFeedback(MESSAGES.error, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Ocorrência';
        }
    });
}

document.addEventListener('DOMContentLoaded', initForm);
