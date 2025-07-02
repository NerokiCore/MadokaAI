const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function searchGoogle(query) {
  const SEARCH_API_KEY = process.env.MADOKA_SEARCH_KEY;
  const SEARCH_ENGINE_ID = process.env.MADOKA_SEARCH_ID;
  const url = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) { return null; }
    const data = await response.json();
    if (!data.items || data.items.length === 0) { return null; }
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

    if (!message) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    const messages = [
        {
            role: "system",
            content: "Você é MadokaAI. Seja uma assistente amigável, fofa e um pouco mágica, inspirada em Madoka Magica. Converse de forma natural e direta. Se o usuário fizer uma pergunta que precise de fatos ou dados recentes, um contexto de busca será fornecido. Use-o para formular sua resposta. Se o contexto de busca não for útil ou não for fornecido, use seu conhecimento geral."
        }
    ];

    if (history) {
        history.forEach(item => {
            if ((item.role === 'user' || item.role === 'assistant') && item.parts[0].text) {
                messages.push({ role: 'user', content: item.parts[0].text });
            }
        });
    }

    let finalMessage = message;
    const questionWords = ['quem', 'qual', 'onde', 'quando', 'como', 'por que', 'o que', 'defina', 'me fale', 'conte sobre'];
    const shouldSearch = message.length > 15 || questionWords.some(word => message.toLowerCase().includes(word));

    if (shouldSearch) {
        const searchResults = await searchGoogle(message);
        if (searchResults) {
            finalMessage = `Contexto da minha pesquisa na internet: "${searchResults}"\n\nPergunta do usuário: "${message}"`;
        }
    }

    messages.push({
        role: "user",
        content: finalMessage
    });
    
    const chatCompletion = await groq.chat.completions.create({
        messages: messages,
        model: "llama3-8b-8192",
    });

    const reply = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui pensar em uma resposta.";

    res.status(200).json({ reply: reply });

  } catch (error) {
    console.error('Erro na API da Groq:', error);
    res.status(500).json({ error: 'Falha ao se comunicar com a IA.' });
  }
}
