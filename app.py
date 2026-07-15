import os
import tempfile
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    source_lang = request.form.get('sourceLang', 'ha')
    target_lang = request.form.get('targetLang', 'en')

    # Keep the original file extension (works for recordings AND uploads)
    original_filename = audio_file.filename or "recording.webm"
    file_ext = os.path.splitext(original_filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_audio:
        audio_file.save(temp_audio.name)
        temp_path = temp_audio.name

    try:
        with open(temp_path, "rb") as file_to_transcribe:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=file_to_transcribe,
                language=source_lang
            )
        original_text = transcription.text

        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate the following text into the language represented by the ISO-639-1 code '{target_lang}'. Only return the translated text, nothing else."},
                {"role": "user", "content": original_text}
            ]
        )
        translated_text = completion.choices[0].message.content

        return jsonify({
            "transcription": original_text,
            "translation": translated_text
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.remove(temp_path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)