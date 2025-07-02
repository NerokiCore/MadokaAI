const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

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
            content: "Você é MadokaAI, uma assistente prestativa e amigável. Responda de forma concisa e direta. Se você não tiver certeza absoluta sobre uma informação factual, é melhor dizer que você não sabe."
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
        content: message
    });
    
    const chatCompletion = await groq.chat.completions.create({
        messages: messages,
        model: "llama3-8b-8192", // Um modelo excelente e rápido
    });

    const reply = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui pensar em uma resposta.";

    res.status(200).json({ reply: reply });

  } catch (error) {
    console.error('Erro na API da Groq:', error);
    res.status(500).json({ error: 'Falha ao se comunicar com a IA.' });
  }
}
