import { useState } from "react";
import "./Authorization.css";

export default function Authorization() {
  const [isRegistration, setIsRegistration] = useState(true);
  return (
    <div className="LoginPanel">
      <h1 className="labelReg"> Регистрация</h1>
      <input className="inputRegister effect effectFocus" type="text" />
      <input className="inputRegister effect effectFocus" type="text" />
      <input className="inputRegister effect effectFocus" type="text" />
      <div>
        <div className="wrapperBtn-1d12">
          <div className="SelectRegAndIn">
            <button
              className={`${isRegistration ? "SelectReg btn-1f2 activeBttn" : "SelectReg btn-1f2"} `}
              onClick={() => {
                setIsRegistration(true);
              }}
            >
              Регистрация
            </button>
            <button
              className={`${isRegistration ? "SelectIn btn-1f2 " : "SelectIn btn-1f2 activeBttn"} `}
              onClick={() => {
                setIsRegistration(false);
              }}
            >
              Вход
            </button>
          </div>
          <button className="buttonIn effect">войти</button>
        </div>
      </div>
    </div>
  );
}
