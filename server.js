const http = require("http");
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const JSZip = require("jszip");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const root = __dirname;
const dataFile = path.join(root, "server-data.json");

function readData(){
    try{
        return JSON.parse(fs.readFileSync(dataFile, "utf8"));
    }catch(error){
        return {accounts:{},tests:[]};
    }
}

function writeData(data){
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
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

async function generateQuestions(text,title){
    if(!process.env.OPENAI_API_KEY){
        try{
            let result = await fetch("http://127.0.0.1:11434/api/generate",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({model:process.env.OLLAMA_MODEL || "llama3.2",stream:false,format:"json",prompt:"Create 5 accurate multiple-choice questions from this lesson. Return ONLY a JSON object with a questions array. Each item must have q (string), c (array of exactly 4 strings), and a (number 0-3). Title: " + title + "\nLesson: " + text})
            });
            if(result.ok){
                let response = await result.json();
                let parsed = JSON.parse(response.response);
                if(Array.isArray(parsed.questions) && parsed.questions.length){
                    return {questions:parsed.questions,mode:"ollama",message:"Questions generated locally with Ollama. Review them before publishing."};
                }
            }
        }catch(error){}
        return {questions:fallbackQuestions(text),mode:"demo",message:"Demo generation used. Start Ollama with a model for local AI questions."};
    }
    let prompt = "Create 5 multiple-choice questions from this lesson. Return ONLY valid JSON as an array. Each item must have q (string), c (array of exactly 4 strings), and a (number 0-3). Title: " + title + "\nLesson: " + text;
    let result = await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer " + process.env.OPENAI_API_KEY},
        body:JSON.stringify({model:process.env.OPENAI_MODEL || "gpt-4o-mini",temperature:0.2,messages:[{role:"system",content:"You create accurate classroom quizzes."},{role:"user",content:prompt}]})
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

    let data = readData();
    if(request.url === "/api/tests"){
        if(request.method === "GET"){sendJson(response,200,data.tests);return;}
        if(request.method === "POST"){
            try{data.tests = JSON.parse(await readBody(request));writeData(data);sendJson(response,200,{saved:true});}
            catch(error){sendJson(response,400,{error:"Invalid tests data."});}
            return;
        }
    }
    if(request.url === "/api/accounts"){
        if(request.method === "GET"){sendJson(response,200,data.accounts);return;}
        if(request.method === "POST"){
            try{data.accounts = JSON.parse(await readBody(request));writeData(data);sendJson(response,200,{saved:true});}
            catch(error){sendJson(response,400,{error:"Invalid accounts data."});}
            return;
        }
    }
    if(request.url === "/api/generate-test" && request.method === "POST"){
        try{
            let payload = JSON.parse(await readBody(request));
            let text = await extractDocumentText(payload.fileName,Buffer.from(payload.data,"base64"));
            if(!text){sendJson(response,400,{error:"No readable text was found in the document."});return;}
            let generated = await generateQuestions(text,payload.title || payload.fileName);
            sendJson(response,200,{title:payload.title || path.basename(payload.fileName,path.extname(payload.fileName)),subject:payload.subject || "General",questions:generated.questions,mode:generated.mode,message:generated.message,sourceText:text.slice(0,500)});
        }catch(error){sendJson(response,400,{error:error.message || "Could not convert the document."});}
        return;
    }
    if(request.method === "GET" && request.url === "/"){
        serveIndex(response);
        return;
    }
    sendJson(response,404,{error:"Not found"});
});

server.listen(port, host, function(){
    console.log("Learning system server running at http://" + host + ":" + port);
});
