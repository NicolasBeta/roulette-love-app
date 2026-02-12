// --- 1. CONFIGURACIÓN ---
// Pega aquí TU configuración (la misma que tenías antes)
const firebaseConfig = {
  apiKey: "AIzaSyCtWniJd3C2N9JpvUhakBlCdLcmJ_O1jis",
  authDomain: "roulette-love-app.firebaseapp.com",
  projectId: "roulette-love-app",
  storageBucket: "roulette-love-app.firebasestorage.app",
  messagingSenderId: "795794281993",
  appId: "1:795794281993:web:0ce1ce994a505def348ad8"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referencias HTML
const carousel = document.getElementById('carousel');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('photo-upload');
const statusMsg = document.getElementById('status-msg');

// Referencias del Modal
const modal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-modal');
const btnRotateLeft = document.getElementById('rotate-left');
const btnRotateRight = document.getElementById('rotate-right');
const btnDelete = document.getElementById('delete-photo');

// Variables de estado
let currentDocId = null; // Para saber qué foto estamos viendo
let currentRotation = 0; // Para saber cuánto hemos girado

// --- FUNCIÓN 1: CARGAR EL CARRUSEL (AUTOMÁTICO) ---
// Escucha cambios en tiempo real: si tu pareja sube una, te aparece sola.
db.collection('fotos').orderBy('fecha', 'desc').onSnapshot((snapshot) => {
    carousel.innerHTML = ""; // Limpiar antes de pintar
    
    if (snapshot.empty) {
        carousel.innerHTML = "<p>No hay recuerdos aún. ¡Sube el primero!</p>";
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Crear la imagen pequeña (thumbnail)
        const img = document.createElement('img');
        img.src = data.imagen;
        img.classList.add('thumbnail');
        
        // Al hacer clic, abrir el modal con ESTA foto
        img.addEventListener('click', () => {
            openModal(data.imagen, doc.id);
        });

        carousel.appendChild(img);
    });
});

// --- FUNCIÓN 2: ABRIR MODAL Y GESTIONAR FOTO ---
function openModal(imageSrc, docId) {
    modal.classList.remove('hidden');
    modalImg.src = imageSrc;
    currentDocId = docId; // Guardamos el ID para poder borrarla luego
    currentRotation = 0; // Resetear rotación
    applyRotation();
}

// Cerrar modal
closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// --- FUNCIÓN 3: ROTAR ---
function applyRotation() {
    modalImg.style.transform = `rotate(${currentRotation}deg)`;
}

btnRotateLeft.addEventListener('click', () => {
    currentRotation -= 90;
    applyRotation();
});

btnRotateRight.addEventListener('click', () => {
    currentRotation += 90;
    applyRotation();
});

// --- FUNCIÓN 4: BORRAR FOTO ---
btnDelete.addEventListener('click', async () => {
    if (confirm("¿Seguro que quieres borrar este recuerdo?")) {
        try {
            await db.collection('fotos').doc(currentDocId).delete();
            modal.classList.add('hidden'); // Cerrar modal
            alert("Recuerdo eliminado");
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("No se pudo borrar.");
        }
    }
});

// --- FUNCIÓN 5: SUBIR FOTO MEJORADA ---

// 1. Conectamos el botón rojo con el input invisible
uploadBtn.addEventListener('click', () => {
    console.log("Botón de subir presionado");
    fileInput.click();
});

// 2. Detectamos cuando eliges el archivo
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
        console.log("No se seleccionó ningún archivo");
        return;
    }

    console.log("Archivo seleccionado:", file.name, "Peso original:", file.size);
    statusMsg.innerText = "Procesando imagen (0%)...";

    try {
        // Paso A: Comprimir
        console.log("Iniciando compresión...");
        const base64String = await resizeAndCompressImage(file);
        console.log("Compresión terminada. Longitud del texto:", base64String.length);
        
        // Paso B: Subir
        statusMsg.innerText = "Subiendo a la nube...";
        console.log("Enviando a Firestore...");
        
        await db.collection('fotos').add({
            imagen: base64String,
            fecha: new Date().toISOString()
        });

        console.log("¡Subida exitosa!");
        statusMsg.innerText = "¡Listo! Recuerdo guardado.";
        
        // Limpiar para poder subir otra
        fileInput.value = ""; 

    } catch (error) {
        console.error("ERROR GRAVE:", error);
        statusMsg.innerText = "Error: " + error.message;
        
        if (error.code === 'permission-denied') {
            alert("Error de permisos: Revisa las reglas de Firestore.");
        } else if (error.toString().includes("exceeds the maximum allowed size")) {
            alert("La imagen comprimida sigue siendo muy grande para el plan gratis. Intenta con una foto más simple.");
        }
    }
});

// --- FUNCIÓN DE COMPRESIÓN MÁS ROBUSTA ---
const resizeAndCompressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        // Si falla la lectura del archivo
        reader.onerror = (error) => reject(new Error("Error leyendo el archivo: " + error));
        
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            
            // Si falla la carga de la imagen (ej: archivo corrupto)
            img.onerror = (error) => reject(new Error("No es una imagen válida"));

            img.src = event.target.result;
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    
                    // CONFIGURACIÓN DE TAMAÑO
                    // Bajamos a 600px para asegurar que pese menos de 1MB (límite Firestore)
                    const MAX_WIDTH = 600; 
                    
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_WIDTH) {
                            width *= MAX_WIDTH / height;
                            height = MAX_WIDTH;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convertir a JPEG calidad 0.6 (60%)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(dataUrl);
                } catch (err) {
                    reject(new Error("Error al procesar el canvas: " + err.message));
                }
            }
        }
    });
}

// --- DECORACIÓN DE FONDO ---
function createFloatingEmoji() {
    const emoji = document.createElement('div');
    const emojis = ['❤️', '🌷', '✨', '🌹']; // Puedes agregar más aquí
    
    // Elegir uno al azar
    emoji.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    emoji.classList.add('floating-emoji');

    // Aleatoriedad para que se vea natural
    const size = Math.random() * 20 + 10; // Tamaño entre 10px y 30px
    const duration = Math.random() * 3 + 4; // Duración entre 4 y 7 segundos
    const position = Math.random() * 100; // Posición horizontal (0% a 100%)

    // Aplicar estilos
    emoji.style.left = position + 'vw';
    emoji.style.fontSize = size + 'px';
    emoji.style.animationDuration = duration + 's';
    
    // Añadir al cuerpo
    document.body.appendChild(emoji);

    // Limpieza: Borrar el elemento cuando termine la animación
    // (para que tu computadora no se ponga lenta)
    setTimeout(() => {
        emoji.remove();
    }, duration * 1000);
}

// Crear un nuevo emoji cada 400 milisegundos (puedes cambiar este número)
setInterval(createFloatingEmoji, 400);