// --- 1. CONFIGURACIÓN ---
// Pega aquí TU configuración (la misma que tenías antes)
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "NUMEROS",
    appId: "NUMEROS"
};

// Inicializar Firebase (Solo Firestore esta vez)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referencias al HTML
const spinBtn = document.getElementById('spin-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('photo-upload');
const currentPhoto = document.getElementById('current-photo');
const statusMsg = document.getElementById('status-msg');

// --- TRUCO: FUNCIÓN PARA CONVERTIR FOTO A TEXTO (BASE64) ---
const resizeAndCompressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Reducimos tamaño para que quepa gratis
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convertir a texto (calidad 0.7 para ahorrar espacio)
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            }
        }
    });
}

// --- FUNCION 1: SUBIR FOTO (COMO TEXTO) ---
uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        alert("Selecciona una foto primero");
        return;
    }

    statusMsg.innerText = "Procesando foto...";

    try {
        // 1. Convertimos la foto a texto
        const base64String = await resizeAndCompressImage(file);

        // 2. Guardamos ese texto directo en la Base de Datos
        statusMsg.innerText = "Subiendo a la nube...";
        await db.collection('fotos').add({
            imagen: base64String, // Aquí va la foto hecha texto
            fecha: new Date().toISOString()
        });

        statusMsg.innerText = "¡Foto guardada con éxito!";
        fileInput.value = ""; 
    } catch (error) {
        console.error(error);
        statusMsg.innerText = "Error: " + error.message;
    }
});

// --- FUNCION 2: RULETA ---
spinBtn.addEventListener('click', async () => {
    currentPhoto.style.opacity = 0.5;

    // Pedimos las fotos a la base de datos
    const snapshot = await db.collection('fotos').get();
    
    if (snapshot.empty) {
        alert("No hay fotos aún. ¡Sube una!");
        currentPhoto.style.opacity = 1;
        return;
    }

    const docs = snapshot.docs;
    const randomIndex = Math.floor(Math.random() * docs.length);
    const randomData = docs[randomIndex].data();

    // El navegador entiende el texto Base64 como una imagen automáticamente
    currentPhoto.src = randomData.imagen;
    currentPhoto.style.opacity = 1;
});