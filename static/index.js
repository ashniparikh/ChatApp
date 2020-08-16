document.addEventListener('DOMContentLoaded', () => {
    username = document.querySelector('#display-name').innerHTML;

    localStorage.setItem('username', username);

    // Set links up to load new channel 
    function setChannelLink() {
        document.querySelectorAll('.channel-link').forEach(link => {
            link.onclick = () => {
                load_channel(link.dataset.channel);
                return false;
            }
        });
    }

    // Check for any previous active channel
    const activeChannel = localStorage.getItem("activeChannel");

    // loop through the channel list to see if there is any previous active channel present
    var prev_load = false;
    Array.from(document.querySelectorAll("#channels>li"), li => {
        if (li.textContent == activeChannel)
            prev_load = true;
        return prev_load
    });

    //If there is any previous channel present than load it, else load general channel
    if (prev_load)
        load_channel(activeChannel);
    else
        load_channel("general");

    // Connect to websocket
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    //Disable create channel button by default
    document.querySelector("#create-channel-button").disabled = true;

    //Enable create button only if there is a text in input field and channel doesn't exist
    document.querySelector("#channel").onkeyup = () => {
        if (document.querySelector("#channel").value.length > 0 && localStorage.getItem("taken") != document.querySelector("#channel").value) {
            var letterNumber = /^[0-9a-zA-Z]+$/;

            if (document.querySelector("#channel").value.match(letterNumber)) {
                document.querySelector("#create-channel-button").disabled = false;
            } else
                document.querySelector('#create-channel-button').disabled = true;
        } else
            document.querySelector('#create-channel-button').disabled = true;
    }

    //Disable send button by default when page load
    document.querySelector('#send').disabled = true;

    //Enable send button only if there is a text in input field for messages
    document.querySelector('#msg').onkeyup = () => {
        if (document.querySelector('#msg').value.length > 0) {
            document.querySelector('#send').disabled = false;
        } else
            document.querySelector('#send').disabled = true;
    }

    // Variable to detect the messages div to scroll up later
    const messages = document.querySelector('#msgs');

    // Renders contents of selected channel
    function load_channel(channel) {
        setChannelLink();

        const request = new XMLHttpRequest();
        request.open('GET', `/channel/${channel}`);
        request.onload = () => {

            // Push state to URL.
            document.title = channel;

            // Store the selected channel in localStorage
            localStorage.setItem('activeChannel', channel)

            //clear out messages
            document.querySelector('#msgs').innerHTML = "";

            //set the channel name as current channel
            document.querySelector('#channel-name').innerHTML = "#" + channel;

            // Template for messages in selected channel
            const template = Handlebars.compile(document.querySelector('#conversations').innerHTML);
            var users_msgs = JSON.parse(request.responseText);

            // Add a deleteOption for deleting the message send by the respective user, By default it's False
            deleteButton = false;
            for (var i = 0; i < users_msgs.length; i++) {
                //if the sender is viewing his own message then set this deleteButton to true
                if (localStorage.getItem('username') === users_msgs[i][0]) {
                    users_msgs[i].push(true);
                }
            }

            const content = template({ 'users_msgs': users_msgs });
            document.querySelector("#msgs").innerHTML += content;

            // Set the amount of vertical scroll equal to total container size
            messages.scrollTop = messages.scrollHeight;
            setDeleteButton();

        };
        request.send();
    }

    //when click on delete button, post will remove
    function setDeleteButton() {
        document.querySelectorAll(".delete-msg").forEach(button => {
            button.onclick = function() {
                this.parentElement.style.animationPlayState = 'running';
                this.parentElement.addEventListener('animationend', () => {
                    this.parentElement.remove();

                    const request = new XMLHttpRequest();
                    const hiddenMsg = this.parentElement.querySelector('#hidden-msg').innerHTML;
                    const channel = localStorage.getItem('activeChannel');
                    request.open('GET', `/delete_msg/${channel}/${hiddenMsg}`);
                    request.send();
                });
            };
        });
    }

    // When connected, configure form submit buttons
    socket.on("connect", () => {
        // Every time user submits a message emit a "new message" event
        document.querySelector("#msg-form").onsubmit = () => {
            const msg = document.querySelector('#msg').value;
            const username = document.querySelector('#display-name').innerHTML;
            channel = localStorage.getItem('activeChannel');
            const today = new Date();
            const time = today.toLocaleString('default', { hour: 'numeric', minute: 'numeric', hour12: true });

            socket.emit('new message', { 'msg': msg, 'username': username, 'channel': channel, 'dateTime': time });
            document.querySelector("#msg").value = "";
            return false;
        }

        // Every time user creates a new channel
        document.querySelector("#create-channel-form").onsubmit = () => {
            const channel = document.querySelector('#channel').value;
            const username = document.querySelector('#display-name').innerHTML;

            socket.emit('new channel', { 'channel': channel, 'username': username });
            return false;
        }
    });

    // When a new message is announced, add the new message in the chat
    socket.on("announce message", data => {
        if (data.success) {
            const template = Handlebars.compile(document.querySelector("#conversations").innerHTML);

            // what we have to render in handlebars
            users_msgs = [
                [data.username, data.dateTime, data.msg, data.deleteButton]
            ];
            const content = template({ 'users_msgs': users_msgs });

            // Check if all the users are in the same channel
            if (localStorage.getItem('activeChannel') === data.channel) {
                document.querySelector("#msgs").innerHTML += content;
                messages.scrollTop = messages.scrollHeight;
            }

            //delete message option for the user who wrote that message
            if (localStorage.getItem("username") === data.username) {
                const messageDiv = document.querySelectorAll('.messages-div');
                const deleteMsg = document.createElement('button');
                deleteMsg.className = 'delete-msg';
                deleteMsg.innerHTML = 'x';
                // Add the delete option to the messages sent by user
                messageDiv[messageDiv.length - 1].append(deleteMsg);
                SetDeleteButton();
            }
        };
    });

    // When new channel is announced, add to the channel list
    socket.on('announce channel', data => {
        if (data.success) {
            document.querySelector('#channel').value = '';
            const template = Handlebars.compile(document.querySelector('#result').innerHTML);
            const content = template({ 'channel': data.channel });
            document.querySelector('#channels').innerHTML += content;

            setChannelLink();
            location.reload();

            if (data.username === document.querySelector('#display-name').innerHTML) {
                load_channel(data.channel);
            }
        } else {
            alert('Channel name already exists.')
        }
    });
});