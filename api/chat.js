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
    if (!response.ok) {
      console.error("Erro na busca do Google:", response.statusText);
      return "Ocorreu um erro ao tentar pesquisar na internet.";
    }
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        return "Não encontrei resultados na internet para essa pergunta.";
    }
    const snippets = data.items.map(item => item.snippet).slice(0, 5).join(" ");
    return snippets.replace(/\n/g, ' ');
  } catch (error) {
    console.error("Erro ao fazer fetch para o Google Search:", error);
    return "Não foi possível conectar à API de busca.";
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

    const searchResults = await searchGoogle(message);

    const augmentedPrompt = `Com base nestas informações da internet: "${searchResults}". Responda à seguinte pergunta do usuário de forma amigável e direta: "${message}"`;

    const messages = [
        {
            role: "system",
            content: "Você é MadokaAI, uma assistente prestativa e amigável. Use as informações da internet fornecidas no início do prompt para basear suas respostas factuais. Se a informação não estiver nos dados da busca ou se a pergunta for de opinião, responda normalmente. Seja sempre concisa."
        }
    ];

    if (history) {
        history.forEach(item => {
            if (item.role === 'user' || item.role === 'assistant') {
                messages.push({ role: item.role, content: item.parts[0].text });
            }
        });
    }

    messages.push({
        role: "user",
        content: augmentedPrompt
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
