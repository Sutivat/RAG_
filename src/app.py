from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import textwrap
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import LLMChain, SequentialChain
from langchain.prompts.chat import SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain.document_loaders import YoutubeLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from langchain.schema import Document
from langchain.prompts import PromptTemplate
import time
import json

load_dotenv(encoding="utf-8")

app = Flask(__name__)
CORS(app)

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

chat = ChatOpenAI(model="llama-3.2-1b-instruct",
                      api_key="fake-key",
                      base_url="http://127.0.0.1:1234/v1")

def create_db_from_youtube_video_url(video_url):
    loader = YoutubeLoader.from_youtube_url(video_url)
    transcript_docs = loader.load()
    transcript_text = "\n".join([doc.page_content for doc in transcript_docs])

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=5000, chunk_overlap=100)
    doc_obj = Document(page_content=transcript_text)
    docs = text_splitter.split_documents([doc_obj])  
    
    # cleaned_docs = []
    # for doc in transcript_docs:
    #     content = doc.page_content.strip()
    #     if len(content) > 10:  # Filter short segments
    #         cleaned_docs.append(Document(content, doc.metadata))

    # text_splitter = RecursiveCharacterTextSplitter(
    #     chunk_size=1500,
    #     chunk_overlap=200,
    #     separators=["\n", " ", ""]
    # )
    # split_docs = text_splitter.split_documents(cleaned_docs)
    # docs = [doc for doc in split_docs if len(doc.page_content.strip()) > 10]

    # additional_info = Document(page_content="")
    # docs.append(additional_info)

    db = FAISS.from_documents(docs, embeddings)
    return db



def get_response_from_query(db, query, k=3):
    # k = db.index.ntotal
    docs = db.similarity_search(query, k=k)
    print('this is docs : {docs}')
    docs_page_content = " ".join([d.page_content for d in docs])

    template = """
        You are a helpful assistant that can answer questions about YouTube videos
        based on the video's transcript: {docs}
        
        "You are a helpful assistant that answers questions based on video transcripts and additional context documents."

        
        If you feel like you don't have enough information to answer the question, say "I don't know".
        """

    system_message_prompt = SystemMessagePromptTemplate.from_template(template)
    human_message_prompt = HumanMessagePromptTemplate.from_template("Answer the following question: {question}")
    messages = [system_message_prompt, human_message_prompt]
    chat_prompt = ChatPromptTemplate.from_messages(messages)
    # 2. สร้าง LLMChain เบื้องต้น (ถ้าต้องการใช้)
    base_chain = LLMChain(llm=chat, prompt=chat_prompt, output_key="answer")

    # 3. Prompt ย่อยแต่ละขั้นตอน (ทุกอันถ้าอยากใช้ docs ก็ใส่ "docs")
    # 1) Restate chain (ต่อด้วยส่วนของ Restatement)
    restate_prompt = PromptTemplate(
        input_variables=["question", "docs"],
        template=template + """

    Restate the following question in your own words:

    Question: {question}

    Restatement:"""
    )

    # 2) Key info chain
    key_info_prompt = PromptTemplate(
        input_variables=["restatement", "docs"],
        template=template + """

    Based on the transcript:

    {docs}

    Extract the key information needed to solve this:

    {restatement}

    Key Info:"""
    )

    # 3) Method chain
    method_prompt = PromptTemplate(
        input_variables=["key_info", "docs"],
        template=template + """

    Using the transcript:

    {docs}

    Outline the method/approach to solve based on:

    {key_info}

    Method:"""
    )

    # 4) Solution chain
    solution_prompt = PromptTemplate(
        input_variables=["method", "docs"],
        template=template + """

    Refer to the transcript:

    {docs}

    Solve this problem step-by-step:

    {method}

    Solution:"""
    )

    # 5) Verification chain
    verify_prompt = PromptTemplate(
        input_variables=["solution", "docs"],
        template=template + """

    Check against the transcript:

    {docs}

    Verify the solution is correct and note any errors:

    {solution}

    Verification:"""
    )

    # 4. สร้าง LLMChain ย่อย ๆ พร้อม output_key
    restate_chain  = LLMChain(llm=chat, prompt=restate_prompt,  output_key="restatement")
    key_info_chain = LLMChain(llm=chat, prompt=key_info_prompt, output_key="key_info")
    method_chain   = LLMChain(llm=chat, prompt=method_prompt,   output_key="method")
    solution_chain = LLMChain(llm=chat, prompt=solution_prompt, output_key="solution")
    verify_chain   = LLMChain(llm=chat, prompt=verify_prompt,   output_key="verification")

    # 5. รวมเป็น SequentialChain โดยบอกว่ามี 2 ตัวเข้า คือ question และ docs
    overall_chain = SequentialChain(
        chains=[
            restate_chain,
            key_info_chain,
            method_chain,
            solution_chain,
            verify_chain
        ],
        input_variables=["question", "docs"],
        output_variables=["restatement", "key_info", "method", "solution", "verification"],
        verbose=True
    )

    # 6. เรียกใช้พร้อมส่งทั้ง question และ docs
    outputs = overall_chain({
        "question": query,
        "docs": docs_page_content
    })

    # 7. ดูผลลัพธ์
    print("Restatement: ",   outputs["restatement"])
    print("Key Info: ",      outputs["key_info"])
    print("Method: ",        outputs["method"])
    print("Solution: ",      outputs["solution"])
    print("Verification: ",  outputs["verification"])
    cleaned_outputs = {k: v.replace("\n", " ") for k, v in outputs.items()}
    # response = chain.run(question=query, docs=docs_page_content)
    # chain = LLMChain(llm=chat, prompt=chat_prompt)
    # result = get_response_with_retries(messages, max_tokens=512, is_final_answer=True)
    # response = chain.run(question=query, docs=docs_page_content)
    # # 1) ขอ final answer (string)
    # final = get_response_with_retries(
    #     messages={"question": "อธิบายเนื้อหาเกี่ยวกับ...?"}, 
    #     max_tokens=512, 
    #     is_final_answer=False, 
    #     docs=docs_page_content
    # )
    # print(final)

    # # 2) ขอเป็น JSON dict (e.g. ใช้ต่อในโค้ด)
    # step = get_response_with_retries(
    #     messages={"question": "ขั้นตอนที่ 1 คืออะไร?"}, 
    #     max_tokens=256, 
    #     is_final_answer=False, 
    #     docs=docs_page_content
    # )
    # print(step)

    # return response.replace("\n", ""), docs
    return outputs["verification"].replace("\n", ""), docs, cleaned_outputs

def get_response_with_retries(messages, max_tokens, is_final_answer=False, docs=""):
    """
    messages: list ของ dict role/content (ignored เมื่อใช้ template ด้านล่าง)
    max_tokens: จำนวนโทเค็นสูงสุด
    is_final_answer: ถ้า True จะคืน str, ถ้า False จะคืน dict (parsed JSON)
    docs: ข้อความ transcript สำหรับใส่ลงใน template
    """

    # สร้าง prompt template ตามที่ต้องการ
    template = """
    You are an expert AI assistant that explains your reasoning step by step. For each step, provide a title that describes what you're doing in that step, along with the content. Decide if you need another step or if you're ready to give the final answer. Respond in JSON format with 'title', 'content', and 'next_action' (either 'continue' or 'final_answer') keys. USE AS MANY REASONING STEPS AS POSSIBLE. AT LEAST 3. BE AWARE OF YOUR LIMITATIONS AS AN LLM AND WHAT YOU CAN AND CANNOT DO. IN YOUR REASONING, INCLUDE EXPLORATION OF ALTERNATIVE ANSWERS. CONSIDER YOU MAY BE WRONG, AND IF YOU ARE WRONG IN YOUR REASONING, WHERE IT WOULD BE. FULLY TEST ALL OTHER POSSIBILITIES. YOU CAN BE WRONG. WHEN YOU SAY YOU ARE RE-EXAMINING, ACTUALLY RE-EXAMINE, AND USE ANOTHER APPROACH TO DO SO. DO NOT JUST SAY YOU ARE RE-EXAMINING. USE AT LEAST 3 METHODS TO DERIVE THE ANSWER. USE BEST PRACTICES.

Example of a valid JSON response:
```json
{
    "title": "Identifying Key Information",
    "content": "To begin solving this problem, we need to carefully examine the given information and identify the crucial elements that will guide our solution process. This involves...",
    "next_action": "continue"
}```
    """
    system_message_prompt = SystemMessagePromptTemplate.from_template(template)
    human_message_prompt  = HumanMessagePromptTemplate.from_template("Answer the following question: {question}")
    chat_prompt           = ChatPromptTemplate.from_messages([system_message_prompt, human_message_prompt])
    chain                 = LLMChain(llm=chat, prompt=chat_prompt)

    for attempt in range(3):
        try:
            # เรียก chain.run โดยส่ง args ชื่อ question และ docs
            print(f"Attempt {attempt+1}: เริ่มเรียก chain.run")
            print(messages.get("question", ""))
            result = chain.run(question=messages.get("question", ""), docs=docs)
            
            print(1)
            print(result)
            if is_final_answer:
                # คืนข้อความเปล่า ๆ (string)
                return result
            else:
                # พยายาม parse เป็น JSON แล้วคืน dict
                return json.loads(result)

        except Exception as e:
            if attempt == 2:
                # ถ้าล้ม 3 ครั้งติด
                error_msg = f"Failed after 3 attempts. Error: {str(e)}"
                if is_final_answer:
                    return error_msg
                else:
                    return {"error": error_msg}
            time.sleep(1)  # รอแล้ว retry

def add_custom_document_to_db(db, file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    doc = Document(page_content=text)
    db.add_documents([doc])
    
    
def ask_ai_directly(question: str) -> str:
    human_message_prompt = HumanMessagePromptTemplate.from_template("{question}")
    chat_prompt = ChatPromptTemplate.from_messages([human_message_prompt])
    
    chain = LLMChain(llm=chat, prompt=chat_prompt)
    response = chain.run(question=question)
    return response.strip()



@app.route('/process', methods=['POST'])
def process():
    data = request.json
    video_url = data.get("video_url")
    query = data.get("query")
    

    if not query:
        return jsonify({"error": "Missing query"}), 400

    if video_url:
        db = create_db_from_youtube_video_url(video_url)
    else:
        # Create empty FAISS index
        dummy_doc = Document(page_content="Placeholder")  # Ensure FAISS gets at least one document
        db = FAISS.from_documents([dummy_doc], embeddings)

    add_custom_document_to_db(db, "custom_text.txt")
    response, docs, cleaned_outputs = get_response_from_query(db, query)

    references = [{"index": i+1, "content": doc.page_content} for i, doc in enumerate(docs)]

    return jsonify({
        "response": response,
        "references": references,
        "response_cleaned": cleaned_outputs
    })

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    query = data.get("query")

    if not query:
        return jsonify({"error": "Missing query"}), 400

    response = ask_ai_directly(query)
    return jsonify({
        "response": response,
        "references": [],
        "response_cleaned": {}
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
