    const http = require("http");
    const fs = require("fs");
    const path = require("path");
    const mammoth = require("mammoth");
    const pdfParse = require("pdf-parse");
    const JSZip = require("jszip");
    const {Pool} = require("pg");

    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || "0.0.0.0";
    const root = __dirname;
    const dataFile = path.join(root, "server-data.json");
    const databaseUrl = process.env.DATABASE_URL;
    const database = databaseUrl ? new Pool({connectionString:databaseUrl,ssl:{rejectUnauthorized:false}}) : null;

    function readData(){
        try{
            let data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
            return {accounts:data.accounts || {},tests:data.tests || [],calendarEvents:data.calendarEvents || [],lessonPlan:data.lessonPlan || []};
        }catch(error){
            return {accounts:{},tests:[],calendarEvents:[],lessonPlan:[]};
        }
    }

    function writeData(data){
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    }

    async function initializeDatabase(){
        if(!database){return;}
        await database.query("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value JSONB NOT NULL)");
        let seed = readData();
        seed.calendarEvents = seed.calendarEvents || [];
        seed.lessonPlan = seed.lessonPlan || [];
        for(let key of ["accounts","tests","calendarEvents","lessonPlan"]){
            await database.query("INSERT INTO app_state (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING",[key,JSON.stringify(seed[key])]);
        }
    }

    async function getData(){
        if(!database){return readData();}
        let result = await database.query("SELECT key,value FROM app_state WHERE key IN ('accounts','tests','calendarEvents','lessonPlan')");
        let data = {accounts:{},tests:[],calendarEvents:[],lessonPlan:[]};
        for(let row of result.rows){data[row.key] = row.value;}
        return data;
    }

    async function saveData(data){
        if(!database){writeData(data);return;}
        await database.query("INSERT INTO app_state (key,value) VALUES ('accounts',$1),('tests',$2),('calendarEvents',$3),('lessonPlan',$4) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",[JSON.stringify(data.accounts),JSON.stringify(data.tests),JSON.stringify(data.calendarEvents || []),JSON.stringify(data.lessonPlan || [])]);
    }

    function sendJson(response,status,data){
        response.writeHead(status,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});
        response.end(JSON.stringify(data));
    }

    function readBody(request){
        return new Promise(function(resolve,reject){
            let body = "";
            request.on("data",function(chunk){body += chunk;});
            request.on("end",function(){resolve(body);});
            request.on("error",reject);
        });
    }

    function cleanText(text){
        return String(text || "").replace(/\s+/g," ").trim().slice(0,30000);
    }

    async function extractDocumentText(fileName,buffer){
        let extension = path.extname(fileName).toLowerCase();
        if(extension === ".pdf"){
            return cleanText((await pdfParse(buffer)).text);
        }
        if(extension === ".docx"){
            return cleanText((await mammoth.extractRawText({buffer:buffer})).value);
        }
        if(extension === ".pptx"){
            let archive = await JSZip.loadAsync(buffer);
            let slideNames = Object.keys(archive.files).filter(function(name){return /^ppt\/slides\/slide\d+\.xml$/i.test(name);}).sort();
            let text = "";
            for(let name of slideNames){
                let xml = await archive.files[name].async("string");
                text += " " + Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map(function(match){return match[1];}).join(" ");
            }
            return cleanText(text);
        }
        throw new Error("Only PDF, DOCX, and PPTX files are supported.");
    }

    function fallbackQuestions(text){
        let sentences = text.split(/[.!?]+/).map(function(value){return value.trim();}).filter(function(value){return value.length > 35;}).slice(0,5);
        return sentences.map(function(sentence,index){
            let words = sentence.split(/\s+/);
            let answer = words[Math.min(3,words.length - 1)];
            let prompt = sentence.replace(answer,"_____ ");
            return {q:"According to the uploaded material, complete this statement: " + prompt,c:[answer,"The opposite idea","A different topic","The material does not say"],a:0};
        });
    }

    async function generateQuestions(text,title,subject,hasTeacherPrompt){
        let instructions = "Create multiple-choice assessment questions. Follow the teacher's request below, including its requested number of questions, audience, difficulty, topic, and format. If no number is requested, create 5. Return only questions with q (string), c (array of exactly 4 strings), and a (number 0-3). Title: " + title + "\nSubject: " + subject + "\nTeacher prompt and/or lesson material:\n" + text;
        if(!process.env.OPENAI_API_KEY){
            try{
                let result = await fetch("http://127.0.0.1:11434/api/generate",{
                    method:"POST",
                    headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({model:process.env.OLLAMA_MODEL || "llama3.2",stream:false,format:"json",prompt:instructions + "\nReturn a JSON object with a questions array."})
                });
                if(result.ok){
                    let response = await result.json();
                    let parsed = JSON.parse(response.response);
                    if(Array.isArray(parsed.questions) && parsed.questions.length){
                        return {questions:parsed.questions,mode:"ollama",message:"Questions generated locally with Ollama. Review them before publishing."};
                    }
                }
            }catch(error){}
            if(hasTeacherPrompt){throw new Error("AI generation is unavailable. Start Ollama or configure OPENAI_API_KEY, then try again.");}
            return {questions:fallbackQuestions(text),mode:"demo",message:"Demo generation used. Start Ollama with a model for local AI questions."};
        }
        let result = await fetch("https://api.openai.com/v1/chat/completions",{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":"Bearer " + process.env.OPENAI_API_KEY},
            body:JSON.stringify({model:process.env.OPENAI_MODEL || "gpt-4o-mini",temperature:0.2,messages:[{role:"system",content:"You create accurate classroom quizzes and follow the teacher's requested topic, audience, difficulty, and number of questions."},{role:"user",content:instructions + "\nReturn only a valid JSON array."}]})
        });
        if(!result.ok){throw new Error("AI service returned " + result.status + ".");}
        let response = await result.json();
        let content = response.choices[0].message.content.replace(/^```json\s*|\s*```$/g,"").trim();
        let questions = JSON.parse(content);
        if(!Array.isArray(questions) || !questions.length){throw new Error("AI returned no questions.");}
        return {questions:questions,mode:"ai",message:"AI-generated questions are ready for review."};
    }

    function serveIndex(response){
        fs.readFile(path.join(root,"index.html"),function(error,content){
            if(error){sendJson(response,500,{error:"Website file is unavailable."});return;}
            response.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
            response.end(content);
        });
    }

    const server = http.createServer(async function(request,response){
        if(request.method === "OPTIONS"){
            response.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"});
            response.end();
            return;
        }

        const requestUrl = new URL(request.url, "http://" + (request.headers.host || "localhost"));
        const pathname = requestUrl.pathname;

        if(pathname === "/api/tests"){
            let data = await getData();
            if(request.method === "GET"){sendJson(response,200,data.tests);return;}
            if(request.method === "POST"){
                try{data.tests = JSON.parse(await readBody(request));await saveData(data);sendJson(response,200,{saved:true});}
                catch(error){sendJson(response,400,{error:"Invalid tests data."});}
                return;
            }
        }
        if(pathname === "/api/accounts"){
            let data = await getData();
            if(request.method === "GET"){sendJson(response,200,data.accounts);return;}
            if(request.method === "POST"){
                try{data.accounts = JSON.parse(await readBody(request));await saveData(data);sendJson(response,200,{saved:true});}
                catch(error){sendJson(response,400,{error:"Invalid accounts data."});}
                return;
            }
        }
        if(pathname === "/api/calendar-events"){
            let data = await getData();
            if(request.method === "GET"){sendJson(response,200,data.calendarEvents || []);return;}
            if(request.method === "POST"){
                try{
                    let events = JSON.parse(await readBody(request));
                    if(!Array.isArray(events)){throw new Error("Calendar events must be an array.");}
                    data.calendarEvents = events;
                    await saveData(data);
                    sendJson(response,200,{saved:true});
                }catch(error){sendJson(response,400,{error:error.message || "Invalid calendar events."});}
                return;
            }
        }
        if(pathname === "/api/lesson-plan"){
            let data = await getData();
            if(request.method === "GET"){sendJson(response,200,data.lessonPlan || []);return;}
            if(request.method === "POST"){
                try{
                    let lessonPlan = JSON.parse(await readBody(request));
                    if(!Array.isArray(lessonPlan)){throw new Error("Lesson plan must be an array.");}
                    data.lessonPlan = lessonPlan;
                    await saveData(data);
                    sendJson(response,200,{saved:true});
                }catch(error){sendJson(response,400,{error:error.message || "Invalid lesson plan."});}
                return;
            }
        }
        if(pathname === "/api/generate-test" && request.method === "POST"){
            try{
                let payload = JSON.parse(await readBody(request));
                let prompt = cleanText(payload.prompt);
                let text = prompt;
                if(payload.data && payload.fileName){
                    let lessonText = await extractDocumentText(payload.fileName,Buffer.from(payload.data,"base64"));
                    if(!lessonText && !prompt){sendJson(response,400,{error:"No readable text was found in the document."});return;}
                    text = prompt ? "Teacher instructions: " + prompt + (lessonText ? "\n\nLesson material: " + lessonText : "") : lessonText;
                }
                if(!text){sendJson(response,400,{error:"Enter a prompt or upload a lesson file."});return;}
                let title = cleanText(payload.title) || (payload.fileName ? path.basename(payload.fileName,path.extname(payload.fileName)) : "AI generated test");
                let subject = cleanText(payload.subject) || "General";
                let generated = await generateQuestions(text,title,subject,Boolean(prompt));
                sendJson(response,200,{title:title,subject:subject,questions:generated.questions,mode:generated.mode,message:generated.message,sourceText:text.slice(0,500)});
            }catch(error){sendJson(response,400,{error:error.message || "Could not convert the document."});}
            return;
        }

        if(request.method === "GET" && (pathname === "/" || pathname === "/index.html")){
            serveIndex(response);
            return;
        }

        sendJson(response,404,{error:"Not found"});
});

    initializeDatabase().then(function(){
        server.listen(port, host, function(){
            console.log("Learning system server running at http://" + host + ":" + port + (database ? " with PostgreSQL storage" : " with local JSON storage"));
        });
    }).catch(function(error){
        console.error("Could not initialize PostgreSQL storage:",error.message);
        process.exit(1);
    });
