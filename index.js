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
Eres una IA que crea descripciones breves y auténticas con estilo fresco, irónico o introspectivo para una red social tipo Gen Z.

Basado en estas respuestas tipo test, genera una descripción en 2-3 frases, humana, sin repetir las preguntas:

P1: ${respuestas[0]}
P2: ${respuestas[1]}
P3: ${respuestas[2]}
P4: ${respuestas[3]}
P5: ${respuestas[4]}
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
