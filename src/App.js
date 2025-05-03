import './App.css';
import raglogo from './assests/raglogo.png';
import addBtn from './assests/add-30.png';
import msgIcon from './assests/message.svg';
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
  const [askDirectly, setAskDirectly] = useState(false);
  const [rooms, setRooms] = useState([
    { id: 1, name: "Room 1", messages: [{ text: "Hi good day", isAi: true }] }
  ]);
  const [currentRoomId, setCurrentRoomId] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState({});
  const msgEnd = useRef(null);

  const stepKeys = [
    { key: "restatement", label: "Restatement" },
    { key: "key_info", label: "Key Info" },
    { key: "method", label: "Method" },
    { key: "solution", label: "Solution" },
    { key: "verification", label: "Verification" }
  ];

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

  const toggleStep = (msgIndex, key) => {
    const id = `${msgIndex}-${key}`;
    setExpandedSteps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleVideoUrlInput = () => {
    setShowVideoUrlInput(prev => !prev);
  };

  const toggleAskMode = () => {
    setAskDirectly(prev => !prev);
  };

  const handleSend = async () => {
    const text = query;
    setQuery('');
    const newMessages = [...currentRoom.messages, { text, isAi: false }];
    updateMessagesForRoom(newMessages);

    setLoading(true);
    try {
      let res;
      if (askDirectly) {
        res = await axios.post("http://localhost:5000/ask", {
          query: text
        });
      } else {
        res = await axios.post("http://localhost:5000/process", {
          video_url: videoUrl,
          query: text
        });
      }

      const aiMessage = {
        text: res.data.response || "No response",
        isAi: true,
        response_cleaned: res.data.response_cleaned || {},
        references: res.data.references || []
      };
      updateMessagesForRoom([...newMessages, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
      updateMessagesForRoom([
        ...newMessages,
        { text: "Sorry, there was an error.", isAi: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = async (e) => {
    if (e.key === 'Enter') await handleSend();
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
      </div>

      <div className='main'>
        <div className="chats">
          {currentRoom.messages.map((message, i) => (
            <div key={i} className={message.isAi ? "chat ai" : "chat"}>
              <img src={message.isAi ? gptImgLogo : userIcon} alt="" className='chatImg' />
              <div className="chat-content">
                <p className="txt">{message.text}</p>

                {/* Structured Response */}
                {message.isAi && message.response_cleaned && (
                  <div className="step-details">
                    {stepKeys.map(({ key, label }) => (
                      message.response_cleaned[key] ? (
                        <div key={key} className="step-item">
                          <button
                            onClick={() => toggleStep(i, key)}
                            className="toggle-button"
                          >
                            {expandedSteps[`${i}-${key}`] ? `Hide ${label}` : `Show ${label}`}
                          </button>
                          {expandedSteps[`${i}-${key}`] && (
                            <p className="step-content">{message.response_cleaned[key]}</p>
                          )}
                        </div>
                      ) : null
                    ))}
                  </div>
                )}

                {/* References */}
                {message.isAi && message.references && message.references.length > 0 && (
                  <div className="references">
                    <h4>References:</h4>
                    <ul>
                      {message.references.map((ref, idx) => (
                        <li key={idx} className="reference-item">
                          {ref.content || "No content available"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
              disabled={askDirectly}
            >
              + Video URL
            </button>
            <button
              className="toggle-mode-btn"
              onClick={toggleAskMode}
              style={{ marginRight: "10px", backgroundColor: askDirectly ? "#4CAF50" : "#ccc" }}
            >
              {askDirectly ? "Direct AI Mode ✅" : "Smart AI Mode 🤖"}
            </button>

            {showVideoUrlInput && !askDirectly && (
              <input
                type="text"
                placeholder="Enter video URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                style={{
                  width: "200px",
                  padding: "5px",
                  borderRadius: "5px"
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
          {loading && <p>Processing...</p>}
          <p>This may be uncorrect.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
