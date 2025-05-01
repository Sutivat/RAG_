import './App.css';
import raglogo from './assests/raglogo.png';
import addBtn from './assests/add-30.png';
import msgIcon from './assests/message.svg';
import home from './assests/home.svg';
import saved from './assests/bookmark.svg';
import rocket from './assests/rocket.svg';
import sendBtn from './assests/send.svg';
import userIcon from './assests/user-icon.png';
import gptImgLogo from './assests/chatgptLogo.svg';
import { useRef, useEffect, useState } from 'react';
import axios from "axios";

function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const msgEnd = useRef(null);

  const sendMsgToRag = async (videoUrl, query) => {
    setLoading(true);
    setResponse(null);
  
    try {
      const res = await axios.post("http://localhost:5000/process", {
        video_url: videoUrl,
        query: query
      });
      return res.data;
    } catch (error) {
      console.error("Error fetching response", error);
      return { response: "Sorry, there was an error." };
    } finally {
      setLoading(false);
    }
  };
  
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
    text: "Hi good day",
    isAi: true,
    }
]);
  useEffect(()=>{
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  },[messages])

  const handleSend = async () => {
    const text = query;
    setQuery(''); // clear input field
    setMessages([...messages, { text, isAi: false }]);
  
    const res = await sendMsgToRag(videoUrl, text);
    setMessages(prev => [
      ...prev,
      { text, isAi: false },
      { text: res.response, isAi: true }
    ]);
  };
  

  const handleEnter = async (e)=> {
    if(e.key ==='Enter') await handleSend();
  }

  return (
    <div className="App">
        <div className='sideBar'>
          <div className="upperSide">
            <div className="upperSideTop"><img src={raglogo} alt="logo" className="logo" /><span className="brand">RAG Youtube Summarize</span></div>
            <button className="midBtn"><img src={addBtn} alt="" className="addBtn" />New Chat</button>
            <div className="upperSideBottom">
              <button className="query"><img src={msgIcon} alt="" />Q1</button>
              <button className="query"><img src={msgIcon} alt="" />Q2</button>
            </div>
          </div>
          <div className="lowerSide">
            <div className="listItems"><img src={home} alt="" className="listitemsImg" />Home</div>
            <div className="listItems"><img src={saved} alt="" className="listitemsImg" />Saved</div>
            <div className="listItems"><img src={rocket} alt="" className="listitemsImg" />Upgrade to Pro</div>
          </div>
        </div>
        <div className='main'>
          <div className="chats">
            {messages.map((message, i) =>
              <div key={i} className={message.isAi?"chat ai":"chat"}>
                <img src={message.isAi?gptImgLogo:userIcon} alt="" className='chatImg'/><p className="txt">{ message.text }</p>
            </div>
            )}
            <div ref={msgEnd}/>
          </div>
          <div className="chatFooter">
            <div className="inp">
              <input type="text" placeholder='Send a message' value={query} onKeyDown={handleEnter} onChange={(e) => setQuery(e.target.value)} /><button className="send" onClick={handleSend}><img src={sendBtn} alt="send" /></button>
            </div>
            <p>This may be uncorrect.</p>
          </div>
        </div>
    </div>
  );
}

export default App;
