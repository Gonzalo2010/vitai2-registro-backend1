import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

app.post('/registro', async (req, res) => {
  const { id, email, nombre_usuario, respuestas } = req.body

  if (!id || !email || !nombre_usuario || !respuestas || respuestas.length < 3) {
    console.error('❌ Datos incompletos recibidos:', req.body)
    return res.status(400).json({ mensaje: 'Faltan datos o respuestas incompletas' })
  }

  const prompt = `
Eres una IA que crea resúmenes de personalidad con estilo irónico, inteligente y directo, para una red social tipo Gen Z donde la gente no quiere descripciones aburridas, sino algo con flow.

A partir de estas respuestas del usuario, crea una descripción corta, graciosa, auténtica, con un toque irónico o introspectivo si hace falta. Tiene que sonar como si un amigo te describiera con sarcasmo, pero con cariño. No repitas las preguntas. Que no parezca generado por una IA.

Respuestas del usuario:
1. ¿Qué te hace único?: ${respuestas[0]}
2. ¿Qué temas te apasionan?: ${respuestas[1]}
3. ¿Cómo te describirían tus amigos?: ${respuestas[2]}

Genera una descripción breve (entre 2 y 4 frases), que suene fresca, humana y con personalidad.
`

  let descripcion_resumida = 'No disponible'

  try {
    const ia = await fetch(process.env.OLLAMA_URL + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openchat',
        prompt: prompt,
        stream: false
      })
    })

    const iaRes = await ia.json()
    console.log('🧠 Respuesta de IA:', iaRes)

    descripcion_resumida = iaRes.response?.trim() || 'Error al procesar descripción'
  } catch (err) {
    console.error('❌ Error al llamar a la IA:', err)
    descripcion_resumida = 'Error con IA'
  }

  console.log('📦 Insertando en Supabase:', {
    id, email, nombre_usuario, respuestas, descripcion_resumida
  })

  const { error } = await supabase.from('usuarios_vitai').insert([{
    id,
    email,
    nombre_usuario,
    respuestas,
    descripcion_resumida
  }])

  if (error) {
    console.error('❌ Error al insertar en Supabase:', error)
    return res.status(500).json({ mensaje: 'Error al guardar en la DB', error: error.message })
  }

  res.json({ mensaje: 'Usuario registrado correctamente' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`✅ Backend Vitai² activo en puerto ${PORT}`))
