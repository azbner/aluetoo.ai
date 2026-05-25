/**
 * ALU AI - CORE FRONTIEND ENGINE (GitHub Pages Ready)
 */

// Éléments du DOM
const chatInput = document.getElementById('chatInput');
const btnSendMessage = document.getElementById('btnSendMessage');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const conversationWrapper = document.getElementById('conversationWrapper');
const sidebar = document.getElementById('sidebar');
const btnOpenSidebar = document.getElementById('btnOpenSidebar');
const btnCloseSidebar = document.getElementById('btnCloseSidebar');
const slashMenu = document.getElementById('slashMenu');
const attachmentsStrip = document.getElementById('attachmentsStrip');
const hiddenFileInput = document.getElementById('hiddenFileInput');
const btnAttachTrigger = document.getElementById('btnAttachTrigger');
const modelSelectorTrigger = document.getElementById('modelSelectorTrigger');
const modelMenu = document.getElementById('modelMenu');
const canvasPanel = document.getElementById('canvasPanel');
const canvasCodeRaw = document.getElementById('canvasCodeRaw');
const sandboxIframe = document.getElementById('sandboxIframe');
const btnCanvasTabCode = document.getElementById('btnCanvasTabCode');
const btnCanvasTabPreview = document.getElementById('btnCanvasTabPreview');
const canvasCodeContainer = document.getElementById('canvasCodeContainer');
const canvasPreviewContainer = document.getElementById('canvasPreviewContainer');
const btnCloseCanvas = document.getElementById('btnCloseCanvas');
const btnMicInput = document.getElementById('btnMicInput');
const btnStopGeneration = document.getElementById('btnStopGeneration');
const historyList = document.getElementById('historyList');
const authOverlay = document.getElementById('authOverlay');

// Variables d'état Globales
let currentConversationId = null;
let databaseConversations = [];
let loadedAttachments = [];
let isGenerating = false;
let currentAbortController = null;
let voiceRecognitionInstance = null;

// Structure de données en mémoire locale
const CONFIG = {
    model: 'gemini-fast',
    temperature: 0.7,
    systemPrompt: localStorage.getItem('alu_system_prompt') || '',
    user: JSON.parse(localStorage.getItem('alu_user_profile')) || null
};

// ─── INITIALISATION DE L'APPLICATION ───
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initDragAndDrop();
    initKeyboardShortcuts();
    checkAuthenticationStatus();
    restoreInputDraft();
    loadConversationsFromStorage();
});

// ─── AUTHENTIFICATION & ONBOARDING ───
function checkAuthenticationStatus() {
    if (CONFIG.user) {
        authOverlay.style.display = 'none';
        document.getElementById('profileName').textContent = CONFIG.user.pseudo;
        document.getElementById('userAvatar').textContent = CONFIG.user.pseudo.charAt(0).toUpperCase();
    } else {
        authOverlay.style.display = 'flex';
    }
}

// Simulation Processus de Connexion OTP / Social
document.getElementById('btnSendOTP').addEventListener('click', () => {
    const email = document.getElementById('authEmail').value;
    if (email.includes('@')) {
        document.getElementById('otpStep1').style.display = 'none';
        document.getElementById('otpStep2').style.display = 'flex';
        // Ici s'exécutera : supabase.auth.signInWithOtp({ email })
        console.log("OTP Envoyé à " + email);
    }
});

document.getElementById('btnVerifyOTP').addEventListener('click', () => {
    const pseudo = document.getElementById('authPseudo').value || 'User' + Math.floor(Math.random()*100);
    CONFIG.user = { pseudo: pseudo, email: document.getElementById('authEmail').value };
    localStorage.setItem('alu_user_profile', JSON.stringify(CONFIG.user));
    checkAuthenticationStatus();
});

document.getElementById('btnGoogleAuth').addEventListener('click', () => {
    // Connexion OAuth Directe
    CONFIG.user = { pseudo: "Google User", email: "google@domain.com" };
    localStorage.setItem('alu_user_profile', JSON.stringify(CONFIG.user));
    checkAuthenticationStatus();
});

document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('alu_user_profile');
    CONFIG.user = null;
    location.reload();
});

// ─── COMPOSER & TEXTAREA INTELLIGENT (AUTO-GROW) ───
chatInput.addEventListener('input', (e) => {
    // Auto-grow
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    
    // Sauvegarde en arrière-plan en cas de crash
    localStorage.setItem('alu_composer_draft', chatInput.value);
    
    // Gestion du menu Slash / Raccourcis
    if (chatInput.value.endsWith('/')) {
        slashMenu.style.display = 'block';
    } else if (!chatInput.value.includes('/')) {
        slashMenu.style.display = 'none';
    }
    
    btnSendMessage.disabled = chatInput.value.trim().length === 0 && loadedAttachments.length === 0;
});

// Déclenchement de l'envoi via Entrée (Sauf si Shift + Entrée)
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!btnSendMessage.disabled && !isGenerating) {
            executeMessageSubmission();
        }
    }
});

function restoreInputDraft() {
    const draft = localStorage.getItem('alu_composer_draft');
    if (draft) {
        chatInput.value = draft;
        chatInput.dispatchEvent(new Event('input'));
    }
}

// Hub de Raccourcis commandes Slash Menu
document.querySelectorAll('#slashMenu .alu-lang-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        const cmd = opt.getAttribute('data-cmd');
        chatInput.value = cmd + " ";
        slashMenu.style.display = 'none';
        chatInput.focus();
    });
});

// ─── AUDIO TO TEXT (ENTRÉE VOCALE AVEC DÉTECTION DE SILENCE) ───
document.getElementById('btnMicInput').addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
        return;
    }

    if (voiceRecognitionInstance) {
        stopVoiceRecognition();
        return;
    }

    voiceRecognitionInstance = new SpeechRecognition();
    voiceRecognitionInstance.lang = 'fr-FR';
    voiceRecognitionInstance.interimResults = true;
    voiceRecognitionInstance.continuous = true;

    let silenceTimer;

    voiceRecognitionInstance.onstart = () => {
        btnMicInput.classList.add('recording');
    };

    voiceRecognitionInstance.onresult = (event) => {
        clearTimeout(silenceTimer);
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if(finalTranscript) {
            chatInput.value += finalTranscript;
            chatInput.dispatchEvent(new Event('input'));
        }

        // Détection de silence automatique après 2.5 secondes
        silenceTimer = setTimeout(() => {
            stopVoiceRecognition();
        }, 2500);
    };

    voiceRecognitionInstance.onerror = () => stopVoiceRecognition();
    voiceRecognitionInstance.onend = () => stopVoiceRecognition();
    
    voiceRecognitionInstance.start();
});

function stopVoiceRecognition() {
    if (voiceRecognitionInstance) {
        voiceRecognitionInstance.stop();
        voiceRecognitionInstance = null;
    }
    btnMicInput.classList.remove('recording');
}

// ─── MULTIMODAL DRAG & DROP & FILES ───
btnAttachTrigger.addEventListener('click', () => hiddenFileInput.click());
hiddenFileInput.addEventListener('change', (e) => handleFilesSelection(e.target.files));

function initDragAndDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFilesSelection(e.dataTransfer.files);
    });
}

function handleFilesSelection(files) {
    if (files.length === 0) return;
    attachmentsStrip.style.display = 'flex';
    
    Array.from(files).forEach(file => {
        const item = { name: file.name, type: file.type, url: URL.createObjectURL(file) };
        loadedAttachments.push(item);
        
        const chip = document.createElement('div');
        chip.className = 'alu-att-chip';
        if (file.type.startsWith('image/')) {
            chip.innerHTML = `<img src="${item.url}"><button class="alu-att-remove">✕</button>`;
        } else {
            chip.innerHTML = `<div class="alu-att-pdf">📄</div><button class="alu-att-remove">✕</button>`;
        }
        
        chip.querySelector('.alu-att-remove').addEventListener('click', () => {
            chip.remove();
            loadedAttachments = loadedAttachments.filter(x => x.url !== item.url);
            if(loadedAttachments.length === 0) attachmentsStrip.style.display = 'none';
        });
        
        attachmentsStrip.appendChild(chip);
    });
    btnSendMessage.disabled = false;
}

// Prompt starters click handlers
document.querySelectorAll('#promptStarters button').forEach(btn => {
    btn.addEventListener('click', () => {
        chatInput.value = btn.getAttribute('data-prompt');
        chatInput.dispatchEvent(new Event('input'));
        executeMessageSubmission();
    });
});

// ─── EXECUTION ET ENVOI DE MESSAGE ───
function executeMessageSubmission() {
    const text = chatInput.value.trim();
    if (!text && loadedAttachments.length === 0) return;

    // Masquer l'accueil si premier message
    welcomeScreen.style.display = 'none';
    messagesContainer.style.display = 'flex';

    // Rendu du message utilisateur immédiatement dans le DOM
    renderMessageUI('user', text, loadedAttachments);

    // Vider le composer
    chatInput.value = '';
    localStorage.removeItem('alu_composer_draft');
    chatInput.style.height = 'auto';
    loadedAttachments = [];
    attachmentsStrip.innerHTML = '';
    attachmentsStrip.style.display = 'none';
    btnSendMessage.disabled = true;

    // Déclencher la réponse de l'IA (Simulée via SSE/Streaming fluide)
    simulateAIResponse(text);
}

// ─── SKELETON LOADERS & RENDU DYNAMIQUE ───
function renderMessageUI(sender, text, attachments = [], branchingIndex = 1, branchingTotal = 1) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `alu-msg alu-msg-${sender}`;

    let attachmentsHTML = '';
    if (attachments.length > 0) {
        attachmentsHTML = `<div class="alu-msg-attachments">`;
        attachments.forEach(att => {
            if (att.type?.startsWith('image/')) {
                attachmentsHTML += `<div class="alu-msg-att-card"><img src="${att.url}"></div>`;
            } else {
                attachmentsHTML += `<div class="alu-msg-att-pdf">📄 ${att.name}</div>`;
            }
        });
        attachmentsHTML += `</div>`;
    }

    // Sélecteur de version si message édité (Branching)
    let branchingHTML = '';
    if (sender === 'user' && branchingTotal > 1) {
        branchingHTML = `
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px; display:flex; gap:6px; align-items:center;">
                <button class="alu-history-pin" style="opacity:1; display:inline;">◂</button>
                <span>${branchingIndex} / ${branchingTotal}</span>
                <button class="alu-history-pin" style="opacity:1; display:inline;">▸</button>
            </div>
        `;
    }

    // Structure interne de la bulle
    if (sender === 'user') {
        msgDiv.innerHTML = `
            <div class="alu-msg-body">
                ${attachmentsHTML}
                <div class="alu-msg-content"><p>${escapeHtml(text)}</p></div>
                ${branchingHTML}
            </div>
            <div class="alu-msg-avatar">${CONFIG.user?.pseudo.charAt(0).toUpperCase() || 'U'}</div>
        `;
    } else {
        // Assistant inclut le Text-To-Speech et le bouton sandbox de base
        msgDiv.innerHTML = `
            <div class="alu-msg-avatar">🤖</div>
            <div class="alu-msg-body">
                <div class="alu-msg-content"></div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="audio-speak-btn" style="font-size:0.8rem; color:var(--muted);">🔊 Écouter</button>
                    <button class="copy-text-btn" style="font-size:0.8rem; color:var(--muted);">📋 Copier</button>
                </div>
            </div>
        `;
    }

    messagesContainer.appendChild(msgDiv);
    conversationWrapper.scrollTop = conversationWrapper.scrollHeight;
    return msgDiv;
}

// Rendu du Thinking Process en accordéon plié
function renderThinkingProcessUI() {
    const container = document.createElement('div');
    container.className = 'alu-msg alu-msg-assistant';
    container.innerHTML = `
        <div class="alu-msg-avatar">⚙️</div>
        <div class="alu-msg-body">
            <details class="alu-lang-menu" style="max-height:none; background:transparent; margin:0;" open>
                <summary style="cursor:pointer; font-size:0.85rem; color:var(--accent); font-weight:500;">
                    [+] Processus de réflexion de l'IA (Dérouler)
                </summary>
                <div class="alu-history-empty" style="padding: 10px 0; line-height:1.5;">
                    <span class="alu-activity-dot"></span> Exploration de la base de connaissances...<br>
                    Analyse des variables et instructions système du profil...
                </div>
            </details>
        </div>
    `;
    messagesContainer.appendChild(container);
    conversationWrapper.scrollTop = conversationWrapper.scrollHeight;
    return container;
}

// ─── SIMULATION STREAMING SSE & DETECTEUR ARTIFACT (SANDBOX) ───
function simulateAIResponse(promptText) {
    isGenerating = true;
    btnStopGeneration.style.display = 'block';
    
    // 1. Étape de réflexion
    const thinkingNode = renderThinkingProcessUI();
    
    setTimeout(() => {
        // Fermer la réflexion après calcul simulé
        thinkingNode.querySelector('details').removeAttribute('open');
        thinkingNode.querySelector('summary').textContent = "✓ Processus de réflexion complété";

        // 2. Création de la zone cible pour le stream de texte
        const aiMsgNode = renderMessageUI('assistant', '');
        const contentTarget = aiMsgNode.querySelector('.alu-msg-content');
        
        // Détection de prompt orienté code pour déclencher le canvas à droite automatiquement
        let isCodeRequest = promptText.toLowerCase().includes('code') || promptText.toLowerCase().includes('html') || promptText.startsWith('/code');
        
        let sampleWords = "Voici une réponse structurée à votre demande.\n\n```html\n<div style='padding:20px; text-align:center; font-family:sans-serif;'>\n  <h1 style='color:#4285f4;'>Composant Isolé Généré</h1>\n  <p>Créé dynamiquement via l'UI d'Alu AI.</p>\n  <button style='background:#4285f4; color:white; border:0; padding:10px 20px; border-radius:8px; cursor:pointer;' onclick='alert(\"Action Canvas !\")'>Cliquez-moi</button>\n</div>\n
```\n\nJ'ai généré ce livrable dans ton espace Canvas dédié à droite pour ne pas saturer notre historique de discussion. Dis-moi si tu veux y apporter des modifications !";
        if(!isCodeRequest) {
            sampleWords = "J'ai traité tes consignes avec succès. Conformément à tes **instructions système globales**, la réponse reste concise et pragmatique. Tu trouveras ci-dessous les points d'analyse requis : \n- **Optimisation** client-side sur Github Pages validée.\n- Intégration de la persistance LocalStorage active.\n\nDes questions complémentaires sur l'implémentation de Supabase Auth ?";
        }

        let wordsArray = sampleWords.split(' ');
        let currentWordIndex = 0;

        // Simulation de la boucle d'affichage mot à mot (Equivalent SSE Stream)
        const streamInterval = setInterval(() => {
            if (!isGenerating) {
                clearInterval(streamInterval);
                return;
            }

            if (currentWordIndex < wordsArray.length) {
                contentTarget.innerHTML += wordsArray[currentWordIndex] + " ";
                // Formater les blocs de code à la volée de manière basique
                formatInlineMarkdown(contentTarget);
                conversationWrapper.scrollTop = conversationWrapper.scrollHeight;
                currentWordIndex++;
            } else {
                clearInterval(streamInterval);
                finalizeGeneration(aiMsgNode, isCodeRequest);
            }
        }, 60);

    }, 1200);
}

function finalizeGeneration(aiMsgNode, openCanvas = false) {
    isGenerating = false;
    btnStopGeneration.style.display = 'none';
    
    // Activer l'écoute vocale de la réponse (TTS)
    aiMsgNode.querySelector('.audio-speak-btn').addEventListener('click', () => {
        const textToRead = aiMsgNode.querySelector('.alu-msg-content').innerText;
        const speech = new SpeechSynthesisUtterance(textToRead);
        speech.lang = 'fr-FR';
        window.speechSynthesis.speak(speech);
    });

    // Activer le bouton de copie
    aiMsgNode.querySelector('.copy-text-btn').addEventListener('click', (e) => {
        navigator.clipboard.writeText(aiMsgNode.querySelector('.alu-msg-content').innerText);
        e.target.textContent = "✓ Copié";
        setTimeout(() => e.target.textContent = "📋 Copier", 2000);
    });

    // Si le rendu contient du code et demande le Canvas/Artifacts double volet
    if (openCanvas) {
        const extractedCode = `<div style='padding:20px; text-align:center; font-family:sans-serif; background:#1e1f20; color:white; min-height:100vh;'>\n  <h1 style='color:#8ab4f8;'>Composant Isolé Canvas</h1>\n  <p>Exécution isolée sécurisée.</p>\n  <button style='background:#4285f4; color:white; border:0; padding:10px 20px; border-radius:8px; cursor:pointer;' onclick='alert(\"Hello Canvas\")'>Tester</button>\n</div>`;
        triggerCanvasDeployment(extractedCode);
    }
    
    saveCurrentConversationState();
}

btnStopGeneration.addEventListener('click', () => {
    isGenerating = false;
    btnStopGeneration.style.display = 'none';
});

// FORMATAGE MARKDOWN MINIMALISTE DE SURFACE
function formatInlineMarkdown(targetElement) {
    let raw = targetElement.innerHTML;
    // Remplacement basique pour la coloration visuelle des balises de code sans libs tierces
    if (raw.includes('```')) {
        raw = raw.replace(/
```html([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        raw = raw.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    }
    targetElement.innerHTML = raw;
}

// ─── PILOTAGE DU CANVAS DYNAMIQUE (DOUBLE VOLET) ───
function triggerCanvasDeployment(codeSource) {
    canvasPanel.style.display = 'flex';
    canvasCodeRaw.textContent = codeSource;
    sandboxIframe.srcdoc = codeSource;
}

btnCanvasTabCode.addEventListener('click', () => {
    btnCanvasTabCode.style.color = 'var(--accent)';
    btnCanvasTabCode.style.borderBottom = '2px solid var(--accent)';
    btnCanvasTabPreview.style.color = 'var(--text-soft)';
    btnCanvasTabPreview.style.borderBottom = 'none';
    canvasCodeContainer.style.display = 'block';
    canvasPreviewContainer.style.display = 'none';
});

btnCanvasTabPreview.addEventListener('click', () => {
    btnCanvasTabPreview.style.color = 'var(--accent)';
    btnCanvasTabPreview.style.borderBottom = '2px solid var(--accent)';
    btnCanvasTabCode.style.color = 'var(--text-soft)';
    btnCanvasTabCode.style.borderBottom = 'none';
    canvasCodeContainer.style.display = 'none';
    canvasPreviewContainer.style.display = 'block';
});

btnCloseCanvas.addEventListener('click', () => {
    canvasPanel.style.display = 'none';
});

// ─── GESTION DES MENUS DE PARAMÈTRES ET MODÈLES ───
modelSelectorTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    modelMenu.style.display = modelMenu.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.alu-model-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.alu-model-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        CONFIG.model = opt.getAttribute('data-model');
        document.getElementById('activeModelLabel').textContent = opt.innerText;
        modelMenu.style.display = 'none';
    });
});

// Instructions Système
const sysModal = document.getElementById('systemPromptModal');
document.getElementById('btnToggleSettings').addEventListener('click', () => {
    sysModal.style.display = 'block';
    document.getElementById('systemPromptArea').value = CONFIG.systemPrompt;
});
document.getElementById('btnCancelSysPrompt').addEventListener('click', () => sysModal.style.display = 'none');
document.getElementById('btnSaveSysPrompt').addEventListener('click', () => {
    CONFIG.systemPrompt = document.getElementById('systemPromptArea').value;
    localStorage.setItem('alu_system_prompt', CONFIG.systemPrompt);
    sysModal.style.display = 'none';
});

// ─── RACCOURCIS CLAVIER (POWER USERS) ───
function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + K : Nouveau Chat
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            resetToNewChatView();
        }
        // Cmd/Ctrl + J : Toggle Sidebar Drawer
        if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
            e.preventDefault();
            sidebar.classList.toggle('open');
        }
    });
}

function resetToNewChatView() {
    messagesContainer.innerHTML = '';
    messagesContainer.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    canvasPanel.style.display = 'none';
    currentConversationId = null;
}

document.getElementById('btnNewChat').addEventListener('click', resetToNewChatView);

// ─── SIDEBAR HISTORIQUE LOCALSTORAGE RESILIENT ───
function saveCurrentConversationState() {
    if(!currentConversationId) {
        currentConversationId = 'conv_' + Date.now();
    }
    const nodes = messagesContainer.querySelectorAll('.alu-msg');
    if(nodes.length === 0) return;

    const firstUserMsg = nodes[0].querySelector('.alu-msg-content')?.innerText || "Fichiers partagés";
    const title = firstUserMsg.substring(0, 24) + "...";

    const index = databaseConversations.findIndex(c => c.id === currentConversationId);
    if(index > -1) {
        databaseConversations[index].html = messagesContainer.innerHTML;
    } else {
        databaseConversations.unshift({ id: currentConversationId, title: title, html: messagesContainer.innerHTML });
    }
    localStorage.setItem('alu_conversations_history', JSON.stringify(databaseConversations));
    loadConversationsFromStorage();
}

function loadConversationsFromStorage() {
    const raw = localStorage.getItem('alu_conversations_history');
    if(raw) {
        databaseConversations = JSON.parse(raw);
        if(databaseConversations.length > 0) {
            historyList.innerHTML = '';
            databaseConversations.forEach(conv => {
                const item = document.createElement('div');
                item.className = 'alu-history-item';
                if(conv.id === currentConversationId) item.classList.add('active');

                item.innerHTML = `
                    <button class="alu-history-title-btn" style="width:100%;">
                        <span class="alu-history-title-text">${escapeHtml(conv.title)}</span>
                    </button>
                    <button class="alu-history-del" title="Supprimer">🗑️</button>
                `;

                item.querySelector('.alu-history-title-btn').addEventListener('click', () => {
                    currentConversationId = conv.id;
                    welcomeScreen.style.display = 'none';
                    messagesContainer.style.display = 'flex';
                    messagesContainer.innerHTML = conv.html;
                    loadConversationsFromStorage(); // Actualiser classe active
                });

                item.querySelector('.alu-history-del').addEventListener('click', (e) => {
                    e.stopPropagation();
                    databaseConversations = databaseConversations.filter(c => c.id !== conv.id);
                    localStorage.setItem('alu_conversations_history', JSON.stringify(databaseConversations));
                    if(currentConversationId === conv.id) resetToNewChatView();
                    loadConversationsFromStorage();
                });

                historyList.appendChild(item);
            });
            return;
        }
    }
    historyList.innerHTML = '<div class="alu-history-empty">Aucune conversation</div>';
}

// Export global (Markdown / JSON)
document.getElementById('btnExportChat').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(databaseConversations));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "alu_conversations_export.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Éléments d'interface mobiles responsives
btnOpenSidebar.addEventListener('click', () => sidebar.classList.add('open'));
btnCloseSidebar.addEventListener('click', () => sidebar.classList.remove('open'));
window.addEventListener('click', (e) => {
    if (!modelSelectorTrigger.contains(e.target)) modelMenu.style.display = 'none';
});

// Utilitaire de protection XSS
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function initEventListeners() {}
