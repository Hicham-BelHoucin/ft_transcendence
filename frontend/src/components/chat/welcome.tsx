import { useState, useRef, useContext, useEffect } from "react";
import { useClickAway } from "react-use";
import { SocketContext } from "../../context/socket.context";
import { AppContext } from "../../context/app.context";
import { ChatContext } from "../../context/chat.context";
import  clsx from "clsx";


const Welcome = ({className} : {className: string}) => {
  const [showPicker, setShowPicker] = useState(false);
  const socket = useContext(ChatContext);
  const {user} = useContext(AppContext)

  const ref = useRef(null);
  useClickAway(ref, () => {
    setShowPicker(false);
  });

  return (
    <div className={clsx("relative overflow-hidden col-span-10 flex h-screen w-full items-center justify-center flex-col justify-start gap-4 rounded-t-3xl rounded-b-3xl bg-secondary-600 lg:col-span-5 xl:col-span-5 2xl:col-span-6 max-wd-md animate-fade-right", className && className )}>
      <div className="flex items-center justify-center p-1 h-full w-full relative" style={{ backgroundImage: `url('/img/chatmenu.svg')`, backgroundRepeat: 'no-repeat', backgroundSize: 'contain', height: 600, width: 600 }}>
        <div className="flex justify-centerbg-opacity-50 backdrop-filter backdrop-blur-lg absolute top-0 left-0 right-0 bottom-0" >
        </div>
        <div > 
          <h1 className="text-primary-500 text-2xl font-montserrat font-bold relative z-10 flex justify-center mb-3">
              Welcome to your chat section! 
          </h1>
          <p className="text-primary-100 text-base font-montserrat relative z-10 flex justify-center mb-3"> Stay connected with your friends. </p>
          <p className="text-primary-100 text-base font-montserrat relative z-10 flex justify-center mb"> Start a new conversation or select one from the list.</p>
          <p className="text-primary-100 text-base font-montserrat relative z-10 flex justify-center mb-3"> Use the search bar to find specific channels. <br /> <br /> </p>
          <p className="text-primary-100 text-base font-montserrat relative z-10 flex justify-center"> Happy chatting!</p>
          
        </div>
      </div>
    </div>
  );
  
  
  
  
  
};


export default Welcome;
/* Welcome to your chat section! Stay connected with your friends. Start a new conversation or select one from the list.Use the search bar to find specific messages.Happy chatting! */
