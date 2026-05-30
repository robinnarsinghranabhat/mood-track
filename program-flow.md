

## frontend
For time being,  User starts a new converstation session. 

After user thing user types and hits enter or clicks ok, 
an api request to backend app (built by teammate): 
POST /conversations/{id}/message
→ { "id": "conv_abc123", "user_type": "human","created_at": "2026-05-30T14:00:00" }

This will save it in database. After that that, this data is converted to text and send to chatbot api through frontend as well. The output of chatbot returned is again posted to above endpoint : 
POST /conversations/{id}/message
→ { "id": "conv_abc123", "user_type": "assistant","created_at": "2026-05-30T14:12:00" }

So above i thought about the text interface, And this is what i think for audio : 

After each start-record and end-record part in that same session, api request sent to : 

POST /conversations/{id}/audio
Body: multipart/form-data (audio file)
→ { "path": "data/audio/conv_abc123.webm" }

The backend will collect all user audios as one through common session id. like all messages part of same chat interface in claude or openai. This is for future analysis but just saving for now. 

Apart from that, frontned will do TTS and save the text output to same endpoint at beginning: 
POST /conversations/{id}/message
→ { "id": "conv_abc123", "user_type": "human","created_at": "2026-05-30T14:15:00" }

Note that, in same session user can provide inputs through voice and text. 

The drill remains same for assistant : 
just respond back based on text response.

What do you think ? I know Agent isn't talking. But for POC, we don't have much time. BTW, teammate is working on actual apis which are not ready now. Suggest any improvements to endpots in this part : 

/Users/rranabha/personal-projects/mood-track/final-Plan-hackathon.md:62
62: ### REST Endpoints

