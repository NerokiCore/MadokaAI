const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest",
        systemInstruction: "Você é MadokaAI, uma assistente prestativa e amigável. Use as informações da internet fornecidas para basear suas respostas factuais. Se a informação não estiver nos dados da busca ou se a pergunta for de opinião, responda normalmente. Seja sempre amigável.",
    });
    
    const chat = model.startChat({
      history: history || [],
    });

    const result = await chat.sendMessage(augmentedPrompt);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ reply: text });

  } catch (error) {
    console.error('Erro no servidor da API:', error);
    res.status(500).json({ error: 'Falha ao se comunicar com a IA.' });
  }
}
