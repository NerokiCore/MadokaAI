const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function generateSearchQuery(message, history) {
    const queryGenMessages = [
        {
            role: "system",
            content: "Você é um assistente que gera termos de busca para o Google. Baseado no histórico da conversa e na última pergunta do usuário, crie um termo de busca curto e eficiente. Se a última pergunta for um cumprimento ou uma conversa casual que não precisa de busca, responda apenas com 'NO_SEARCH'. Responda APENAS com o termo de busca ou 'NO_SEARCH'."
        },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : h.role, content: h.parts[0].text })),
        { role: "user", content: message }
    ];
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: queryGenMessages,
            model: "llama3-8b-8192", // Usamos o modelo rápido para esta tarefa simples
        });
        const result = chatCompletion.choices[0]?.message?.content.trim();
        return result === 'NO_SEARCH' ? null : result;
    } catch (error) {
        return null; 
    }
}

async function searchGoogle(query) {
  if (!query) return null;
  const SEARCH_API_KEY = process.env.MADOKA_SEARCH_KEY;
  const SEARCH_ENGINE_ID = process.env.MADOKA_SEARCH_ID;
  const url = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;
    return data.items.map(item => item.snippet).slice(0, 4).join(" ").replace(/\n/g, ' ');
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { message, history } = req.body;
    if (!message) { return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' }); }

    const smartSearchQuery = await generateSearchQuery(message, history || []);
    const searchResults = await searchGoogle(smartSearchQuery);

    const mainMessages = [
        {
            role: "system",
            content: "Você é MadokaAI, uma assistente gente boa, fofa e amigável, inspirada em Madoka Magica. Converse naturalmente. Se um contexto de busca for fornecido, use-o como sua principal fonte de verdade para responder à pergunta do usuário. Se o contexto for nulo ou não ajudar, use o histórico da conversa e seu conhecimento geral."
        }
    ];

    if (history) {
        history.forEach(item => {
            if ((item.role === 'user' || item.role === 'assistant') && item.parts[0].text) {
                mainMessages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: item.parts[0].text });
            }
        });
    }

    let finalPrompt = message;
    if (searchResults) {
        finalPrompt = `(Use este contexto da web para responder: "${searchResults}")\n\nPergunta do usuário: "${message}"`;
    }
    mainMessages.push({ role: "user", content: finalPrompt });
    
    const chatCompletion = await groq.chat.completions.create({
        messages: mainMessages,
        model: "llama3-70b-8192", // AQUI ESTÁ O UPGRADE
    });

    const reply = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui pensar em uma resposta.";
    res.status(200).json({ reply: reply });

  } catch (error) {
    console.error('Erro fatal no handler da API:', error);
    res.status(500).json({ error: 'Ocorreu um erro crítico no servidor.' });
  }
};
