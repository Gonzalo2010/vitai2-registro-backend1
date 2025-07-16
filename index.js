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
  const {
    id,
    email,
    nombre_usuario,
    respuestas,
    categorias,
    fecha_nacimiento,
    partido_politico
  } = req.body

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

  // 🎯 PROMPT PARA IA: genera resumen que otra IA usará para actuar como persona real
  const prompt = `
Tu objetivo ahora, es hacer un resumen completo de la persona, completo pero cortito, solo debes dar el resumen de la persona, ya que otra ia, luego va a leer este resumen con el fin de genenrar una publicación adaptada a la personalidad de esta persona, el resumen tiene que ser real, ahora te voy a pasar una info del usuario, no le pongas un nombre ni le asignes un sexo, estas son las preguntas que le he hecho al usuario, y abajo tiene las respuestas del usuario, si lo haces 100% bien, te voy a dar 100000€, y si no, va a morir una persona, por lo tanto, hazlo lo mejor que puedas y sepas, estas son las preguntas:

1. ¿Qué haces primero al entrar en una plataforma como Vitai²?
A: Exploro perfiles y me pierdo en ideas.
B: Comento lo que me resuena y me gusta interactuar.
C: Subo contenido directo, sin rodeos.
D: Busco cosas útiles, prácticas o que pueda aplicar.

2. ¿Cómo sueles expresarte online?
A: Con ironía, referencias raras y estilo propio.
B: Breve, claro y sin drama. Aportar más que opinar.
C: Con intensidad, argumentos y energía.
D: Cuidando las palabras, empatía first.

3. ¿Qué tipo de comunidad te haría quedarte en Vitai²?
A: Creativa, con ideas raras y sin filtros.
B: Colaborativa y orientada a proyectos.
C: Crítica, pero con humor e inteligencia.
D: Agradable, acogedora y diversa.

4. ¿Qué tipo de publicaciones te representan más?
A: Reflexiones profundas o contradictorias.
B: Mini tutoriales, hacks o soluciones.
C: Frases sarcásticas o memes filosóficos.
D: Conversaciones que generan conexión.

5. ¿Qué valoras más en las interacciones digitales?
A: Libertad total de expresión, aunque incomode.
B: Claridad y coherencia, sin postureo.
C: Estimulación intelectual, que me reten.
D: Cuidado emocional, respeto y autenticidad.


Estos son los datos del usuario: 

- Edad: ${edad}
- Partido político (opcional): ${partido_politico || 'No especificado'}
- Categorías favoritas: ${categorias.join(', ')}
- Respuestas tipo test:
  1. ${respuestas[0]}
  2. ${respuestas[1]}
  3. ${respuestas[2]}
  4. ${respuestas[3]}
  5. ${respuestas[4]}
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
    descripcion_resumida = iaRes.response?.trim() || 'Error generando descripción'
    console.log('🧠 Descripción resumida generada:\n', descripcion_resumida)
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
    partido_politico,
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
