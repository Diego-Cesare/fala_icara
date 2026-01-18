// Configurações do EmailJS e mensagens
const CONFIG = {
    EMAILJS_PUBLIC_KEY: 'cVEeTAPWCWxVNoU_H',
    EMAILJS_SERVICE_ID: 'service_xi26o83',
    EMAILJS_TEMPLATE_ID: 'template_4gyqkkj',
    RECIPIENT_EMAIL: 'diegocesare300491@gmail.com'
};

// Mensagens de feedback ao usuário
const MESSAGES = {
    success: 'Ocorrência enviada com sucesso! Obrigado pela contribuição.',
    error: 'Erro ao enviar. Tente novamente em alguns instantes.',
    validation: 'Por favor, preencha todos os campos obrigatórios.',
    sending: 'Enviando sua ocorrência...',
    geolocating: 'Obtendo sua localização...',
    geolocateSuccess: 'Localização obtida com sucesso!',
    geolocateError: 'Não foi possível obter sua localização. Verifique as permissões.'
};

// Prewiew da foto selecionada
function setupPhotoPreview() {
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImg');
    const removePhotoBtn = document.getElementById('removePhotoBtn');

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                photoPreview.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    });

    removePhotoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        photoInput.value = '';
        photoPreview.style.display = 'none';
        previewImg.src = '';
    });
}

// Obtém a localização do usuário
function getGeolocation() {
    const locationInput = document.getElementById('location');
    const geoBtn = document.getElementById('geolocateBtn');

    if (!navigator.geolocation) {
        showFeedback('Geolocalização não é suportada por seu navegador', 'error');
        return;
    }

    geoBtn.disabled = true;
    showFeedback(MESSAGES.geolocating, 'info');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
                // API de geocoding reverso do OpenStreetMap Nominatim
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    const address = data.address;
                    
                    const street = address.road || address.street || '';
                    const houseNumber = address.house_number || '';
                    const neighbourhood = address.neighbourhood || address.suburb || '';
                    const city = address.city || address.town || '';
                    
                    let fullAddress = [street, houseNumber, neighbourhood, city]
                        .filter(part => part)
                        .join(', ');
                    
                    if (!fullAddress) {
                        fullAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    }
                    
                    locationInput.value = fullAddress;
                    showFeedback(MESSAGES.geolocateSuccess, 'success');
                } else {
                    throw new Error('Erro ao obter endereço');
                }
            } catch (error) {
                console.error('Erro ao fazer geocoding reverso:', error);
                locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                showFeedback('Localização obtida (coordenadas)', 'success');
            } finally {
                geoBtn.disabled = false;
            }
        },
        (error) => {
            geoBtn.disabled = false;
            let errorMessage = MESSAGES.geolocateError;
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Você negou permissão de localização';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Informações de localização indisponíveis';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'A solicitação de localização expirou';
                    break;
            }
            
            showFeedback(errorMessage, 'error');
            console.error('Erro de geolocalização:', error);
        }
    );
}


// Valida os dados do formulário
function validateFormData(data) {
    if (!data.issue_type?.trim()) {
        showFeedback('Selecione um tipo de ocorrência', 'error');
        return false;
    }
    if (!data.description?.trim() || data.description.trim().length < 10) {
        showFeedback('A descrição deve ter pelo menos 10 caracteres', 'error');
        return false;
    }
    if (!data.location?.trim()) {
        showFeedback('Informe a localização da ocorrência', 'error');
        return false;
    }
    return true;
}

// Mostra feedback ao usuário
function showFeedback(message, type = 'success') {
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.textContent = message;
    feedbackEl.className = `feedback feedback-${type}`;
    feedbackEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 5000);
    }
}

// Converte arquivo de imagem para Base64 com redimensionamento e compressão
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Redimensiona a imagem
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Reduz para máximo 1600px de largura
                const maxWidth = 1600;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Comprime em JPEG com qualidade 0.7 (reduz muito o tamanho)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                resolve(compressedBase64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Coleta os dados do formulário
async function getFormData() {
    const formData = {
        issue_type: document.getElementById('issue-type').value,
        description: document.getElementById('description').value,
        location: document.getElementById('location').value,
        to_email: CONFIG.RECIPIENT_EMAIL,
        photo: ''
    };

    // Processa a imagem se existir
    const photoInput = document.getElementById('photo');
    if (photoInput.files && photoInput.files[0]) {
        try {
            formData.photo = await fileToBase64(photoInput.files[0]);
        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            showFeedback('Erro ao processar a imagem', 'error');
        }
    }

    return formData;
}

// Envia o formulário via EmailJS
async function sendForm(formData) {
    try {
        showFeedback(MESSAGES.sending, 'info');
        
        const response = await emailjs.send(
            CONFIG.EMAILJS_SERVICE_ID,
            CONFIG.EMAILJS_TEMPLATE_ID,
            formData
        );
        
        if (response.status === 200) {
            return { success: true };
        }
    } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        return { success: false, error };
    }
}

// Inicializa o formulário e seus eventos
function initForm() {
    if (typeof emailjs === 'undefined') {
        console.error('EmailJS não foi carregado. Verifique sua conexão de internet.');
        showFeedback('Erro ao carregar o serviço de envio. Tente novamente.', 'error');
        return;
    }

    emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);

    const form = document.getElementById('reportForm');
    const submitBtn = form.querySelector('.btn-submit');
    const geoBtn = document.getElementById('geolocateBtn');

    if (!form) {
        console.error('Formulário não encontrado no DOM');
        return;
    }

    // Inicializa preview de foto
    setupPhotoPreview();

    // Listener para botão de geolocalização
    geoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        getGeolocation();
    });

    // Listener para envio do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Desabilita botão durante envio
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            const formData = await getFormData();
            
            if (!validateFormData(formData)) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Ocorrência';
                return;
            }

            // Envia formulário
            const result = await sendForm(formData);

            if (result.success) {
                showFeedback(MESSAGES.success, 'success');
                form.reset();
                submitBtn.textContent = 'Ocorrência Enviada ✓';
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Ocorrência';
                }, 2000);
            } else {
                showFeedback(MESSAGES.error, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Ocorrência';
            }
        } catch (error) {
            console.error('Erro inesperado:', error);
            showFeedback(MESSAGES.error, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Ocorrência';
        }
    });
}

document.addEventListener('DOMContentLoaded', initForm);
