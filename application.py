import os,re,json

from flask import Flask, render_template, session, redirect, request, jsonify
from flask_socketio import SocketIO, emit
from flask_session import Session


app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)

# Configure session to use filesystem
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Remember all users and channels created
usernmaes=[]
channels=['general']

# A dict with channel and list of all messages details of that channel
channel_msgs= {"general":[]}

@app.route("/")
def index():
    username =session.get('username')

    if not username:
        return render_template("login.html")
    else:
        return render_template("index.html", username=username,channels=channels,channel_msgs=channel_msgs['general'])

@app.route("/login", methods=["POST", "GET"])
def login():
    username=request.form.get("display-name")
    #store the username in session
    session['username']=username
    usernmaes.append(username)
    return redirect("/")

@socketio.on("new channel")
def new_channel(data):
    username=data["username"]
    channel=data["channel"]

    if channel in channels:
        emit("announce message", {"success":False})
    else:
        channels.append(channel)
        channel_msgs[channel]=[]
        emit("announce channel", {"success":True,"username":username, "channel":channel, "channel_msgs":[]},broadcast= True)

@socketio.on("new message")
def messages(data):
    username =data["username"]
    msg=data["msg"]
    channel =data["channel"]
    dateTime= data["dateTime"]

    if len(channel_msgs[channel])>=1000:
        emit("announce message",{"success":False})
    else:    
        channel_msgs[channel].append([username,dateTime,msg])
        emit("announce message",{"success":True, "channel":channel,"username":username, "dateTime": dateTime,"msg": msg},broadcast=True)

@app.route('/channel/<channel>')
def channel(channel):
    #when user changes a channel
    return json.dumps(channel_msgs[channel])

@app.route('/delete_msg/<activeChannel>/<hiddenMsg>',methods=["POST"])
def delete_msg(activeChannel, hiddenMsg):
    msg = list(hiddenMsg.split(","))
    msg.pop()

    msgs_list = channel_msgs[activeChannel]
    for i in range(len(msgs_list)):
        if msgs_list[i] == msg:
            del channel_msgs[activeChannel][i]
            return 'OK'
    
    return 'OK'


    
