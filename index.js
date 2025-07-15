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

function calcularEdad(fechaNacimiento) {
  const hoy = new Date()
  const nacimiento = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const m = hoy.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--
  }
  return edad
}

app.post('/registro', async (req, res) => {
  const { id, email, nombre_usuario, respuestas, categorias, fecha_nacimiento } = req.body

  if (!id || !email || !nombre_usuario || !respuestas || respuestas.length < 5 || !categorias || !fecha_nacimiento) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios' })
  }

  const edad = calcularEdad(fecha_nacimiento)
  if (edad < 14) {
    console.log(`🛑 Usuario menor de 14 años: ${email}, eliminando...`)

    try {
      await supabase.auth.admin.deleteUser(id)
      await supabase.from('usuarios_vitai').delete().eq('id', id)
    } catch (err) {
      console.error('❌ Error eliminando al menor:', err)
    }

    return res.status(403).json({ mensaje: 'Debes tener al menos 14 años', eliminado: true })
  }

const prompt = `
Tu tarea es generar una breve descripción de un usuario basada en sus respuestas tipo test. La descripción debe estar en tercera persona, con tono fresco, directo, algo irónico o reflexivo, como si un amigo cercano lo estuviera describiendo. No debe parecer que la escribe él mismo, y no debes repetir las preguntas ni incluir sus letras (A, B...).

Usa 2-3 frases que transmitan su personalidad. Este resumen aparecerá en su perfil de una red social con estética Gen Z.

Respuestas del usuario:
- ${respuestas[0]}
- ${respuestas[1]}
- ${respuestas[2]}
- ${respuestas[3]}
- ${respuestas[4]}
`


  let descripcion_resumida = 'No disponible'

  try {
    const ia = await fetch(process.env.OLLAMA_URL + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openchat',
        prompt,
        stream: false
      })
    })

    const iaRes = await ia.json()
    descripcion_resumida = iaRes.response?.trim() || 'Descripción no generada'
    console.log('🧠 IA generó:', descripcion_resumida)
  } catch (err) {
    console.error('❌ Error con la IA:', err)
    descripcion_resumida = 'Error con IA'
  }

  const { error } = await supabase.from('usuarios_vitai').insert([{
    id,
    email,
    nombre_usuario,
    fecha_nacimiento,
    respuestas,
    categorias,
    descripcion_resumida
  }])

  if (error) {
    console.error('❌ Error al insertar en Supabase:', error)
    return res.status(500).json({ mensaje: 'Error al guardar en la base de datos' })
  }

  res.json({ mensaje: 'Usuario registrado correctamente' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`✅ Backend Vitai² activo en puerto ${PORT}`))
