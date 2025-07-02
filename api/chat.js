const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function generateSearchQuery(message, history) {
    const queryGenMessages = [
        {
            role: "system",
            content: "Você é um assistente que gera termos de busca para o Google. Baseado no histórico da conversa e na última pergunta do usuário, crie um termo de busca curto e eficiente. Responda APENAS com o termo de busca, sem nenhuma outra palavra ou explicação."
        }
    ];

    history.forEach(item => {
        if ((item.role === 'user' || item.role === 'assistant') && item.parts[0].text) {
            queryGenMessages.push({ role: item.role, content: item.parts[0].text });
        }
    });

    queryGenMessages.push({ role: "user", content: message });
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: queryGenMessages,
            model: "llama3-8b-8192",
        });
        return chatCompletion.choices[0]?.message?.content.trim() || message;
    } catch (error) {
        console.error("Erro ao gerar a query de busca:", error);
        return message; // Em caso de erro, busca a mensagem original do usuário
    }
}

async function searchGoogle(query) {
  const SEARCH_API_KEY = process.env.MADOKA_SEARCH_KEY;
  const SEARCH_ENGINE_ID = process.env.MADOKA_SEARCH_ID;
  const url = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) { return `(Ocorreu um erro na busca: Status ${response.status})`; }
    const data = await response.json();
    if (!data.items || data.items.length === 0) { return "(Não encontrei resultados na internet para essa pergunta.)"; }
    return data.items.map(item => item.snippet).slice(0, 4).join(" ").replace(/\n/g, ' ');
  } catch (error) {
    return `(Não foi possível conectar à API de busca: ${error.message})`;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { message, history } = req.body;
    if (!message) { return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' }); }

    const smartSearchQuery = await generateSearchQuery(message, history);
    const searchResults = await searchGoogle(smartSearchQuery);

    const mainMessages = [
        {
            role: "system",
            content: "Você é MadokaAI, uma assistente gente boa e amigável. Converse naturalmente. Para perguntas factuais, use as informações de busca fornecidas no prompt para dar uma resposta precisa. Se a busca não ajudar, use seu conhecimento geral, mas se não tiver certeza, admita que não sabe a resposta."
        }
    ];

    if (history) {
        history.forEach(item => {
            if ((item.role === 'user' || item.role === 'assistant') && item.parts[0].text) {
                mainMessages.push({ role: item.role, content: item.parts[0].text });
            }
        });
    }

    const augmentedPrompt = `Contexto da minha pesquisa na internet sobre sua pergunta: "${searchResults}". Pergunta do usuário: "${message}"`;
    mainMessages.push({ role: "user", content: augmentedPrompt });
    
    const chatCompletion = await groq.chat.completions.create({
        messages: mainMessages,
        model: "llama3-8b-8192",
    });

    const reply = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui pensar em uma resposta.";
    res.status(200).json({ reply: reply });

  } catch (error) {
    console.error('Erro na API da Groq:', error);
    res.status(500).json({ error: 'Falha ao se comunicar com a IA.' });
  }
}
