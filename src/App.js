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
  const [loading, setLoading] = useState(false);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [rooms, setRooms] = useState([{ id: 1, name: "Room 1", messages: [{ text: "Hi good day", isAi: true }] }]);
  const [currentRoomId, setCurrentRoomId] = useState(1);
  const msgEnd = useRef(null);

  const sendMsgToRag = async (videoUrl, query) => {
    setLoading(true);
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

  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const updateMessagesForRoom = (newMessages) => {
    setRooms(prevRooms =>
      prevRooms.map(room =>
        room.id === currentRoomId ? { ...room, messages: newMessages } : room
      )
    );
  };

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [rooms]);

  const handleSend = async () => {
    const text = query;
    setQuery('');
    const newMessages = [...currentRoom.messages, { text, isAi: false }];
    updateMessagesForRoom(newMessages);

    const res = await sendMsgToRag(videoUrl, text);
    updateMessagesForRoom([...newMessages, { text: res.response, isAi: true }]);
  };

  const handleEnter = async (e) => {
    if (e.key === 'Enter') await handleSend();
  };

  const toggleVideoUrlInput = () => {
    setShowVideoUrlInput(prev => !prev);
  };

  const createNewRoom = () => {
    const newId = rooms.length + 1;
    const newRoom = { id: newId, name: `Room ${newId}`, messages: [] };
    setRooms([...rooms, newRoom]);
    setCurrentRoomId(newId);
  };

  return (
    <div className="App">
      <div className='sideBar'>
        <div className="upperSide">
          <div className="upperSideTop">
            <img src={raglogo} alt="logo" className="logo" />
            <span className="brand">RAG Youtube Summarize</span>
          </div>
          <button className="midBtn" onClick={createNewRoom}>
            <img src={addBtn} alt="" className="addBtn" />New Chat
          </button>
          <div className="upperSideBottom">
            {rooms.map((room) => (
              <button
                key={room.id}
                className={`query ${room.id === currentRoomId ? 'active' : ''}`}
                onClick={() => setCurrentRoomId(room.id)}
              >
                <img src={msgIcon} alt="" />{room.name}
              </button>
            ))}
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
          {currentRoom.messages.map((message, i) => (
            <div key={i} className={message.isAi ? "chat ai" : "chat"}>
              <img src={message.isAi ? gptImgLogo : userIcon} alt="" className='chatImg' />
              <p className="txt">{message.text}</p>
            </div>
          ))}
          <div ref={msgEnd} />
        </div>
        <div className="chatFooter">
          <div className="inp">
            <button
              className="add-video-url-btn"
              onClick={toggleVideoUrlInput}
              style={{ marginRight: "10px" }}
            >
              + Video URL
            </button>

            {showVideoUrlInput && (
              <input
                type="text"
                placeholder="Enter video URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                style={{
                  width: "200px",
                  padding: "5px",
                  borderRadius: "5px",
                  marginTop: "10px"
                }}
              />
            )}

            <input
              type="text"
              placeholder='Send a message'
              value={query}
              onKeyDown={handleEnter}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="send" onClick={handleSend}>
              <img src={sendBtn} alt="send" />
            </button>
          </div>
          <p>This may be uncorrect.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
