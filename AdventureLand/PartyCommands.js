function all_reload_code()
{
	for (var char of get_characters())
	{
		(char.online != '0' && char.name != character.name)
		{
			send_cm(char.name,{type:'reload_code'});
		}
	}
	reload_code();
}

function reload_code()
{
	//stop_character(character.name);
	//load_code('Main');
}

function clean_all_screens()
{
	for (var char of get_characters())
	{
		(char.online != '0')
		{
			send_cm(char.name, {type:'clean_screen'});
		}
	}
}

function clean_screen()
{
	parent.hide_modals();
}

function on_cm(name,data)
{
	if (is_your_char(name))
	{
		game_log("Received cm from " + name);
		game_log(JSON.stringify(data));
		
		var cm_type = data.type;
		if (cm_type == 'party_request')
		{
			send_party_invite(name);
		}
		else if (cm_type == 'offload_inventory')
		{
			offload_inventory(name);
		}
		else if (cm_type == 'reload_code')
		{
			reload_code();
		}
		else if (cm_type == 'clean_screen')
		{
			clean_screen();
		}
	}
}

function on_party_invite(name)
{
	if (is_your_char(name))
	{
		accept_party_invite(name);
	}
}

function on_party_request(name)
{
	if (is_your_char(name))
	{
		accept_party_request(name);
	}
}

var last_party_try = null;
function join_the_party()
{
	if (character.party != null) return;
	if (last_party_try == null || ((last_party_try + 5000) < Date.now()))
	{
		last_party_try = Date.now();
		var current_server = get_current_server();
		var other_online_chars = get_other_online_chars();
		for (var other_char of other_online_chars)
		{
			if (other_char.server == current_server)
			{
				send_cm(other_char.name,{type:'party_request'});
				break;
			}
		}
	}
}

function get_other_online_chars()
{
	var other_online_chars = [];
	for (const user_character of get_characters())
	{
		if (user_character.online != '0' && user_character.name != character.name)
		{
			other_online_chars.push(user_character);
		}
	}
	return other_online_chars;
}

function get_current_server()
{
	var current_server;
	for (const user_character of get_characters())
	{
		if (user_character.name == character.name)
		{
			current_server = user_character.server;
			break;
		}
	}
	return current_server;
}

function is_your_char(char_name)
{
	for (const user_character of get_characters())
	{
		if (char_name == user_character.name)
		{
			return true
		}
	}
	return false;
}

function offload_inventory(receiver)
{
	var items_to_keep = ['hpot0','mpot0','hpot1','mpot1','tracker'];
	for (var i = 0; i < character.items.length; i++)
	{
		var item = character.items[i];
		if (item != null && !items_to_keep.includes(item.name))
		{
			send_item(receiver,i,item.q)
		}
	}
	send_gold(receiver,floor(character.gold/2));
}
