const potion_run_iterval = 1000*60*35;
var last_potion_run = null;
var potion_runs = 0;

async function potion_run()
{
	if (potion_runs > 0) 
	{
		if ((last_potion_run + potion_run_iterval) > Date.now()) 
		{
			return;
		}
	}
	last_potion_run = Date.now();
	potion_runs++;
	
	await close_shop();
	var num_pots = get_num_pots()
	if (num_pots['hpot0'] == null || num_pots['hpot0'] < 600)
	{
		await go_buy('hpot0',{max:600,buy_what_you_can:true});
	}
	if (num_pots['hpot1'] == null || num_pots['hpot1'] < 600)
	{
		await go_buy('hpot1',{max:600,buy_what_you_can:true});
	}
	
	if (num_pots['mpot0'] == null || num_pots['mpot0'] < 600)
	{
		await go_buy('mpot0',{max:600,buy_what_you_can:true});
	}
	if (num_pots['mpot1'] == null || num_pots['mpot1'] < 600)
	{
		await go_buy('mpot1',{max:600,buy_what_you_can:true});
	}
	
	await exchange_with_farmers();
}

async function exchange_with_farmers()
{
	var party_dict = get_party();
	var hunters = [];
	for (var char_name in party_dict)
	{
		var char_details = party_dict[char_name];
		if (char_name != character.name && char_details.type != 'merchant')
		{
			var info = {}
			info.name = char_name;
			info.map = char_details.map;
			info.x = char_details.x;
			info.y = char_details.y;
			info.type = char_details.type;
			hunters.push(info);
		}
	}
	if (seems_bad(hunters)) return;
	
	for (var i = 0; i < hunters.length; i++)
	{
		var hunter = hunters[i];
		await smart_move({map:hunter.map,x:hunter.x,y:hunter.y});
		game_log('Requesting offload from ' + hunter.name);
		send_cm(hunter.name,{type:'offload_inventory'});
		hp1_pot_index = locate_item('hpot0');
		mp1_pot_index = locate_item('mpot0');
		hp2_pot_index = locate_item('hpot1');
		mp2_pot_index = locate_item('mpot1');
		send_item(hunter.name,hp1_pot_index,200);
		send_item(hunter.name,mp1_pot_index,200);
		send_item(hunter.name,hp2_pot_index,200);
		send_item(hunter.name,mp2_pot_index,200);
	}
}

async function go_buy(item_id,options)
{
	var npc_merchant = find_closest_seller_of(item_id);
	await smart_move(npc_merchant.location);
	await sn_buy(item_id,options);
}

async function sn_buy(item_id,options)
{
	var amount_to_buy = 0;
	if (options.amount && options.amount > 0)
	{
		amount_to_buy = options.amount;
	}
	else if (options.max && options.max > 0)
	{
		var item_count = get_item_count_of(item_id);
		amount_to_buy = options.max - item_count;
	}

	if (amount_to_buy && amount_to_buy > 0)
	{
		var cost = calc_cost(item_id,amount_to_buy);
		if (cost > character.gold)
		{
			if (options.buy_what_you_can == true)
			{
				cost_per_item = calc_cost(item_id,1);
				amount_to_buy = floor(character.gold / cost_per_item);
			}
			else
			{
				game_log('Not enough gold!');
				reject("not enough gold");
			}
		}
		await buy(item_id, amount_to_buy);
	}
}

// Finds the closest npc merchant who sells the item.
function find_closest_seller_of(item_id)
{
	var result = null;
	for (var npc_id in G.npcs)
	{
		var npc = G.npcs[npc_id];
		if (npc.role == 'merchant' && npc.items && npc.items.includes(item_id))
		{
			var npc_location = find_npc(npc_id);
			if (npc_location)
			{
				// TO-DO this probably doesn't work too well if in other map.
				var dist = distance_to(npc_location.x,npc_location.y);
				if (dist)
				{
					if (result == null || (dist < result.distance))
					{
						result = {merch:npc,location:npc_location,distance:dist};
					}	
				}
			}
		}
	}
	return result;
}

async function close_shop()
{
	if (character.standed != null)
	{
		parent.close_merchant();
	}
}

async function open_shop()
{
	if (character.standed == null)
	{
		parent.open_merchant(locate_item("stand0"));
	}
}