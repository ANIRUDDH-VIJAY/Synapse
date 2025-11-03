import "./Sidebar.css";
import { useContext, useEffect } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";

function Sidebar() {
    const {
        allThreads,
        setAllThreads,
        currThreadId,
        setNewChat,
        setPrompt,
        setReply,
        setCurrThreadId,
        setPrevChats,
        reply
    } = useContext(MyContext);

    const getAllThreads = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/thread`);
            const res = await response.json();
            const filteredData = res.map(thread => ({
                threadId: thread.threadId,
                title: thread.title
            }));
            setAllThreads(filteredData);
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        getAllThreads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currThreadId, reply]);

    const createNewChat = () => {
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPrevChats([]);
    };

    const changeThread = async (newThreadId) => {
        setCurrThreadId(newThreadId);
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/thread/${newThreadId}`);
            const res = await response.json();
            console.log(res);
            setPrevChats(res || []);
            setNewChat(false);
            setReply(null);
        } catch (err) {
            console.log(err);
            setPrevChats([]);
        }
    };

    const deleteThread = async (threadId) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/thread/${threadId}`, { method: "DELETE" });
            if (response.ok) {
                setAllThreads(prev => prev.filter(thread => thread.threadId !== threadId));
                if (threadId === currThreadId) createNewChat();
            } else {
                console.log("Delete failed");
            }
        } catch (err) {
            console.log(err);
        }
    };

    return (
        <section className="sidebar">
            <button onClick={createNewChat}>
                <img src="/blacklogo.png" alt="Synapse logo" className="logo" />
                <span><i className="fa-solid fa-pen-to-square"></i></span>
            </button>

            <ul className="history">
                {allThreads?.map((thread, idx) => (
                    <li
                        key={idx}
                        onClick={() => changeThread(thread.threadId)}
                        className={thread.threadId === currThreadId ? "highlighted" : ""}
                    >
                        {thread.title}
                        <i
                            className="fa-solid fa-trash"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteThread(thread.threadId);
                            }}
                        ></i>
                    </li>
                ))}
            </ul>

            <div className="sign">
                <p>Aniruddh Vijayvargia&hearts;</p>
            </div>
        </section>
    );
}

export default Sidebar;
