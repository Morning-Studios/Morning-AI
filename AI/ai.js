const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");

const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;

// Import Google Generative AI library
// Note: You'll need to include this library in your HTML or install via npm
const GOOGLE_API_KEY = "AIzaSyBUBbUaQCniWm4PrwzDbbPDWuIZCY4zpIA";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;

// Example code for direct usage (this can be used for testing outside the chat interface)
// This is the example code you wanted to add
const testGeminiAPI = async () => {
    try {
        // Using the library approach
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI("YOUR_API_KEY");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = "Explain how AI works";
        
        const result = await model.generateContent(prompt);
        console.log(result.response.text());
    } catch (error) {
        console.error("Test API call failed:", error);
    }
};

// Initialize Google Generative AI client for the chat interface
let genAI;
let model;

try {
    // This will work if the GoogleGenerativeAI library is loaded in browser
    if (typeof GoogleGenerativeAI !== 'undefined') {
        genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        // Use gemini-pro model (v1 API)
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log("Gemini API client initialized successfully");
    }
} catch (error) {
    console.error("GoogleGenerativeAI library not loaded:", error);
    // Fallback to direct API approach
}

// Load saved data from local storage
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    chatHistoryContainer.innerHTML = '';

    // Iterate through saved chat history and display messages
    savedConversations.forEach(conversation => {
        // Display the user's message
        const userMessageHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
               <p class="message__text">${conversation.userMessage}</p>
            </div>
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // Display the API response
        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 
                            conversation.apiResponse?.text || '';
        const parsedApiResponse = marked.parse(responseText); // Convert to HTML
        const rawApiResponse = responseText; // Plain text version

        const responseHtml = `
           <div class="message__content">
                <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
        `;

        const incomingMessageElement = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);

        const messageTextElement = incomingMessageElement.querySelector(".message__text");

        // Display saved chat without typing effect
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true); // 'true' skips typing
    });

    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
}

// Show typing effect
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    copyIconElement.classList.add("hide"); // Initially hide copy button

    if (skipEffect) {
        // Display content directly without typing
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide"); // Show copy button
        isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        if (wordIndex === wordsArray.length) {
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
        }
    }, 75);
};

// Fetch API response using the new GoogleGenerativeAI library
const requestApiResponseWithLibrary = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        // Generate content using the Google Generative AI library (v1 API)
        const result = await model.generateContent(currentUserMessage);
        const responseText = result.response.text();
        
        if (!responseText) throw new Error("Invalid API response.");

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation in local storage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: { text: responseText }  // Store in a format compatible with existing storage
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    } catch (error) {
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest(".message").classList.add("message--error");
        console.error("API Error:", error);
    } finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};

// Fallback to the old fetch method
const requestApiResponseWithFetch = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    
    try {
        const response = await fetch(API_REQUEST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: currentUserMessage }] }]
            }),
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error.message);

        const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("Invalid API response.");

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation in local storage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    } catch (error) {
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest(".message").classList.add("message--error");
        console.error("API Error:", error);
    } finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};

// Unified request function that tries the library first, then falls back to fetch
const requestApiResponse = async (incomingMessageElement) => {
    try {
        if (genAI && model) {
            await requestApiResponseWithLibrary(incomingMessageElement);
        } else {
            await requestApiResponseWithFetch(incomingMessageElement);
        }
    } catch (error) {
        console.error("All API methods failed:", error);
        const messageTextElement = incomingMessageElement.querySelector(".message__text");
        messageTextElement.innerText = "Failed to connect to Gemini API. Please check your API key and connection.";
        messageTextElement.closest(".message").classList.add("message--error");
        incomingMessageElement.classList.remove("message--loading");
        isGeneratingResponse = false;
    }
};

// Add copy button to code blocks
const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text';

        const languageLabel = document.createElement('div');
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add('code__language-label');
        block.appendChild(languageLabel);

        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add('code__copy-btn');
        block.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

// Show loading animation during API request
const displayLoadingAnimation = () => {
    const loadingHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
    `;

    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);

    requestApiResponse(loadingMessageElement);
};

// Copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;

    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`; // Confirmation icon
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000); // Revert icon after 1 second
};

// Handle sending chat messages
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
    if (!currentUserMessage || isGeneratingResponse) return; // Exit if no message or already generating response

    isGeneratingResponse = true;

    const outgoingMessageHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>
    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset(); // Clear input field
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500); // Show loading animation after delay
};

// Toggle between light and dark themes
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    // Update icon based on theme
    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// Clear all chat history
clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");

        // Reload chat history to reflect changes
        loadSavedChatHistory();

        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// Handle click on suggestion items
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// Prevent default from submission and handle outgoing message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// Uncomment to run the test function (only for Node.js environment)
// testGeminiAPI();

// Load saved chat history on page load
loadSavedChatHistory();

// Theme Toggling
const themeToggler = document.getElementById('themeToggler');
const body = document.body;
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Initialize theme
if (isDarkMode) {
    body.classList.add('dark-theme');
    themeToggler.innerHTML = '<i class="bx bx-moon"></i>';
} else {
    themeToggler.innerHTML = '<i class="bx bx-sun"></i>';
}

themeToggler.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    body.classList.toggle('dark-theme');
    themeToggler.innerHTML = isDarkMode ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';
    localStorage.setItem('darkMode', isDarkMode);
});

// Chat functionality
const chatSection = document.querySelector('.chats');
const promptForm = document.querySelector('.prompt__form');
const promptInput = document.querySelector('.prompt__form-input');
const sendButton = document.getElementById('sendButton');
const deleteButton = document.getElementById('deleteButton');
const suggestItems = document.querySelectorAll('.suggests__item');

// API configuration
const API_URL = 'http://localhost:8000';
let userName = localStorage.getItem('userName') || '';

// Initialize Morning briefing on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadMorningBriefing();
    } catch (error) {
        console.error('Error loading morning briefing:', error);
        addMessageToChat('system', 'Sorry, I couldn\'t load your morning briefing. Please check if the API server is running.');
    }
});

// Load morning briefing
async function loadMorningBriefing() {
    const response = await fetch(`${API_URL}/briefing?name=${userName}`);
    if (!response.ok) {
        throw new Error('Failed to fetch morning briefing');
    }
    
    const data = await response.json();
    
    // Create greeting message
    const greeting = `
# ${data.greeting}
Today is ${data.date}

## Weather
🌡️ ${Math.round(data.weather.temperature)}°F - ${data.weather.condition}
💧 Humidity: ${data.weather.humidity}%
💨 Wind: ${data.weather.wind_speed.toFixed(1)} mph

## Today's Events
${data.events.map(event => {
    const time = new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return `- **${time}**: ${event.title}${event.location ? ` at ${event.location}` : ''}`;
}).join('\n')}

## Top News
${data.news.map(item => `- **${item.title}**: ${item.summary}`).join('\n')}

## Quote of the Day
> ${data.quote_of_the_day}
    `;
    
    addMessageToChat('system', greeting);
}

// Add message to chat
function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat');
    messageElement.classList.add(sender === 'user' ? 'chat--user' : 'chat--ai');
    
    const iconName = sender === 'user' ? 'bx-user' : 'bx-bot';
    
    messageElement.innerHTML = `
        <div class="chat__icon">
            <i class='bx ${iconName}'></i>
        </div>
        <div class="chat__content">
            ${sender === 'user' ? message : marked.parse(message)}
        </div>
    `;
    
    chatSection.appendChild(messageElement);
    
    // Apply syntax highlighting to code blocks
    if (sender === 'system') {
        messageElement.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
    
    // Scroll to the bottom
    chatSection.scrollTop = chatSection.scrollHeight;
}

// Process user query
async function processUserQuery(query) {
    try {
        // Add user message to chat
        addMessageToChat('user', query);
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('chat', 'chat--ai', 'chat--typing');
        typingIndicator.innerHTML = `
            <div class="chat__icon">
                <i class='bx bx-bot'></i>
            </div>
            <div class="chat__content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatSection.appendChild(typingIndicator);
        chatSection.scrollTop = chatSection.scrollHeight;
        
        // Process the query
        let response;
        
        // Check for specific commands
        if (query.toLowerCase().includes('weather')) {
            const weatherResponse = await fetch(`${API_URL}/weather`);
            const weatherData = await weatherResponse.json();
            response = `
## Current Weather
🌡️ ${Math.round(weatherData.temperature)}°F - ${weatherData.condition}
💧 Humidity: ${weatherData.humidity}%
💨 Wind: ${weatherData.wind_speed.toFixed(1)} mph
            `;
        } else if (query.toLowerCase().includes('news')) {
            const newsResponse = await fetch(`${API_URL}/news`);
            const newsData = await newsResponse.json();
            response = `
## Today's Top News
${newsData.map((item, index) => `${index + 1}. **${item.title}**: ${item.summary}`).join('\n\n')}
            `;
        } else if (query.toLowerCase().includes('calendar') || query.toLowerCase().includes('schedule') || query.toLowerCase().includes('events')) {
            const calendarResponse = await fetch(`${API_URL}/calendar`);
            const calendarData = await calendarResponse.json();
            response = `
## Today's Events
${calendarData.map(event => {
    const time = new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return `- **${time}**: ${event.title}${event.location ? ` at ${event.location}` : ''}`;
}).join('\n')}
            `;
        } else if (query.toLowerCase().includes('quote')) {
            const quoteResponse = await fetch(`${API_URL}/quote`);
            const quoteData = await quoteResponse.json();
            response = `
> ${quoteData.quote}
            `;
        } else if (query.toLowerCase().includes('my name is') || query.toLowerCase().includes('call me')) {
            // Extract name
            const nameMatch = query.match(/(?:my name is|call me) ([a-zA-Z]+)/i);
            if (nameMatch && nameMatch[1]) {
                userName = nameMatch[1];
                localStorage.setItem('userName', userName);
                response = `Nice to meet you, ${userName}! I'll remember your name for future sessions.`;
            } else {
                response = "I didn't catch your name. Could you please repeat it?";
            }
        } else if (query.toLowerCase().includes('help')) {
            response = `
## How to use Morning AI

Here are some things you can ask me:
- "What's the weather like today?"
- "Show me the latest news"
- "What's on my calendar today?"
- "Give me an inspirational quote"
- "My name is [your name]" to personalize your experience

You can also ask me general questions, and I'll do my best to help!
            `;
        } else {
            // This would be where you'd connect to a more sophisticated AI model
            // For now, we'll just provide a simple response
            response = `I received your query: "${query}"\n\nThis is a simple response as this demo doesn't include a full AI model. In a complete implementation, this would connect to GPT, Claude, or another AI service to process complex queries.`;
        }
        
        // Remove typing indicator
        chatSection.removeChild(typingIndicator);
        
        // Add AI response to chat
        addMessageToChat('system', response);
        
    } catch (error) {
        console.error('Error processing query:', error);
        addMessageToChat('system', 'Sorry, I encountered an error while processing your request. Please try again.');
    }
}

// Event listeners
promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = promptInput.value.trim();
    if (query) {
        processUserQuery(query);
        promptInput.value = '';
    }
});

// Suggest items click
suggestItems.forEach(item => {
    item.addEventListener('click', () => {
        const suggestText = item.querySelector('.suggests__item-text').textContent.trim();
        promptInput.value = suggestText;
        processUserQuery(suggestText);
    });
});

// Delete button to clear chat
deleteButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
        chatSection.innerHTML = '';
        loadMorningBriefing();
    }
});

// Make input field grow with content
promptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});
