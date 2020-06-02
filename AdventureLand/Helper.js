// Helper stuff.

class SN_Set
{
	constructor(object_in)
	{
		this.d_set = {};
		for (var obj_key in object_in)
		{
			var obj_value = object_in[obj_key];
			this.d_set[obj_value] = true;
		}
  	}
	
  	has(obj_key)
	{
    	return this.d_set[obj_key] || false;
	}
	
	add(obj_key)
	{
		this.d_set[obj_key] = true;
	}
	
	remove(obj_key)
	{
		delete this.d_set[obj_key];
	}
	
	toString()
	{
		var output = '{', is_first = true;
		for (var obj_key in this.d_set)
		{
			if (is_first)
			{
				output += obj_key;
			}
			else
			{
				output += ',' + obj_key;
			}
			is_first = false;
		}
		output += '}';
		
    	return output;
	}
}

function calc_cost(item_id,amount)
{
	return (G.items[item_id].g * amount);
}

function distance_to(x_in,y_in)
{
	return calc_distance(character.x,character.y,x_in,y_in);
}

function calc_distance(x1,y1,x2,y2)
{
	return Math.sqrt(Math.pow((x1-x2), 2) + Math.pow((y1-y2), 2));
}

function sleep(milli)
{
  return new Promise(resolve => {setTimeout(() => {resolve('resolved');}, milli);});
}

// Returns the number of free slots in the character's inventory.
function get_free_slots_available()
{
	var free_slots_available = 0;
	for (var bag_slot = 0; bag_slot < character.items.length; bag_slot++)
	{
		var item = character.items[bag_slot];
		if (item == null) free_slots_available++;
	}
	return free_slots_available;
}

/*
- Attempts to store items in the bank.
- Tries to stack the item if possible.
- Otherwise tries to place the item with similar items.
- Otherwise tries to place the item in the first free bank slot.
*/
const bank_location = {map:'bank',x:-0.3,y:-85.6};
const dont_bank_items = new SN_Set(['stand0','hpot0','hpot1','mpot0','mpot1']);
const bank_size = 42;
const bank_delay = 1000*60*15; // 15 minutes.
var next_bank_session = null;
async function bank_items()
{
	if (get_free_slots_available() >= 21) return;
	if (next_bank_session != null || Date.now() > next_bank_session) return;
	next_bank_session = Date.now() + bank_delay;

	await close_shop();
	await smart_move(bank_location);
	for (var bag_slot = 0; bag_slot < character.items.length; bag_slot++)
	{
		var item = character.items[bag_slot];
		if (item == null) continue;
		if (dont_bank_items.has(item.name)) continue;

		var free_slot = null;
		var best_free_slot = null;
		var was_stored = false;
		
		for (var bank_id in character.bank)
		{
			var bank_bag = character.bank[bank_id];
			if (bank_bag == null) continue;
			var bank_free_slot = null, bank_has_same_item = false;
			for (var bank_slot = 0; bank_slot < bank_size; bank_slot++)
			{
				var bank_item = bank_bag[bank_slot];
				if (bank_item == null)
				{
					bank_free_slot = bank_free_slot || {b:bank_id,s:bank_slot};
					free_slot = free_slot || bank_free_slot;
				}
				else if (bank_item.name == item.name)
				{
					bank_has_same_item = true;
					if (can_stack(item,bank_item))
					{
						await bank_store(bag_slot,bank_id,bank_slot);
						was_stored = true;
						break;
					}
				}
				
				if (best_free_slot == null)
				{
					if (bank_free_slot != null && bank_has_same_item == true)
					{
						best_free_slot = best_free_slot || bank_free_slot;
					}
				}
			}
			if (was_stored == true) break;
		}
		if (was_stored == true) continue;
		
		
		var bank_slot_to_use = best_free_slot || free_slot;
		if (bank_slot_to_use == null)
		{
			game_log('Not enough bank space!');
		}
		else
		{
			await bank_store(bag_slot,bank_slot_to_use.b,bank_slot_to_use.s);
		}
	}
}

function get_item_count_of(item_id)
{
	var item_count = 0;
	for (var i = 0; i < character.items.length; i++)
	{
		var item = character.items[i];
		if (item != null && item.name == item_id)
		{
			item_count += item.q || 1;
		}
	}
	return item_count;
}

function gather_item_values()
{
	var results = {};
	for (var i = 0; i < character.items.length; i++)
	{
		var item = character.items[i];
		if (item != null)
		{
			results[item.name] = item_value(item);
		}
	}
	return results;
}

// Load potion item information.
var potion_info = {};
for (var item_id in G.items)
{
	var item = G.items[item_id];
	if (item.type == 'pot')
	{
		var pot_give_type = item.gives[0][0];
		var pot_give_amount = item.gives[0][1];
		var pot_cost = item.g;
		var pot_dict = {id:item_id,give_amount:pot_give_amount,cost:pot_cost};
		if (pot_give_type != null && potion_info[pot_give_type] == null)
		{
			potion_info[pot_give_type] = [];
		}
		potion_info[pot_give_type].push(pot_dict);
	}
}

// Tries to find a potion that is effective without being too wasteful.
function get_efficient_potion(pots,missing_amount)
{
	var efficient_pot = null;
	for (pot_index in pots)
	{
		var next_pot = pots[pot_index];
		var give_amount = next_pot.give_amount;
		
		var pot_location = locate_item(next_pot.id);
		if (pot_location < 0)
		{
			continue; // Player doesn't own this potion.
		}
		
		var wasted_amount = give_amount - missing_amount;
		if (wasted_amount > (give_amount / 3))
		{
			continue; // Try not to waste the better potions.
		}
		
		var restore_amt = min(missing_amount,give_amount);
		if (efficient_pot == null || efficient_pot.restore_amt < restore_amt || (efficient_pot.restore_amt == restore_amt && efficient_pot.cost > next_pot.cost))
		{
			efficient_pot = next_pot;
			efficient_pot.location = pot_location;
			efficient_pot.restore_amt = restore_amt;
		}
	}
	return efficient_pot;
}

var hp_mp_cooldown_point = Date.now();
async function use_hp_or_mp_pots()
{
	if (Date.now() < hp_mp_cooldown_point)
	{
		return; // Potions and regen skills are on cooldown.
	}

	var percent_hp = floor(100 * (character.hp / character.max_hp));
	var missing_hp = character.max_hp - character.hp;
	var percent_mp = floor(100 * (character.mp / character.max_mp));
	var missing_mp = character.max_mp - character.mp;
	
	var potion_to_chug = null;
	if (percent_hp < 65)
	{
		var hp_pots = potion_info['hp'];
		potion_to_chug = get_efficient_potion(hp_pots,missing_hp);
	} // TO-DO : get_effective_potion (most hp healed, ordered by cost);
	else if (percent_mp < 50)
	{
		var mp_pots = potion_info['mp'];
		potion_to_chug = get_efficient_potion(mp_pots,missing_mp);
	}

	if (potion_to_chug != null)
	{
		consume(potion_to_chug.location);
	}
	else
	{
		if (percent_hp < percent_mp)
		{
			use_skill('regen_hp');
		}
		else
		{
			use_skill('regen_mp');
		}
	}
	hp_mp_cooldown_point = Date.now() + 2000 + min(character.ping*3,200);
}

// Returns the number of potions in the inventory.
function get_num_pots()
{
	var results = {};
	for (var i = 0; i < character.items.length; i++)
	{
		var item = character.items[i];
		if (item != null && potion_info[item.name] != null)
		{
			var number_of_this_pot = results[item.name];
			if (number_of_this_pot == null)
			{
				results[item.name] = item.q;
			}
			else
			{
				results[item.name] = number_of_this_pot + item.q;
			}
		}
	}
	return results;
}

function is_in_boundary(boundary)
{
	var x1 = boundary[0];
	var y1 = boundary[1];
	var x2 = boundary[2];
	var y2 = boundary[3];
	if (character.x > x1 && character.y > y1)
	{
		if (character.x < x2 && character.y < y2) 
		{
			return true;
		}
	}
	return false;
}

function center_of_boundary(boundary)
{
	var x1 = boundary[0];
	var y1 = boundary[1];
	var x2 = boundary[2];
	var y2 = boundary[3];
	return {x:floor((x1+x2)/2),y:floor((y1+y2)/2)};
}

function get_best_area_for_monster(mon_id)
{
	var best_area = {};
	for (var map_key in G.maps)
	{
		var map = G.maps[map_key];
		if (seems_bad(map)) continue;
			
		for (var monster_zone_index in map.monsters)
		{
			var monster_zone = map.monsters[monster_zone_index];
			if (seems_bad(monster_zone)) continue;
			
			if (monster_zone.type == mon_id)
			{
				if (best_area[map_key] == null)
				{
					best_area[map_key] = monster_zone;
				}
				else if (monster_zone.count > best_area[map_key].count)
				{
					best_area[map_key] = monster_zone;
				}
			}
		}
	}
	if (seems_bad(best_area)) return null;
	
	// Try to give the easiest area of the possibilities.
	var selected_zone = {};
	if (best_area['main'] != null)
	{
		selected_zone = best_area['main'];
		selected_zone.map = 'main';
	}
	else
	{
		for (var map_key in best_area)
		{
			var zone_info = best_area[map_key];
			if (zone_info != null)
			{
				selected_zone = best_area[map_key];
				selected_zone.map = map_key;
				break;
			}
		}
	}

	var result = {};
	result.type = selected_zone.type;
	result.map = selected_zone.map;
	result.boundary = selected_zone.boundary;
	result.center = center_of_boundary(selected_zone.boundary);
	return result;
}

function get_item_grade(item_id,level)
{
	if (has_bad([item_id,level])) return -1;
	var item = G.items[item_id];
	if (has_bad([item,item.grades])) return -1;
	
	var grade = 0;
	for (var i = 0; i < item.grades.length; i++)
	{
		if (item.grades[i] <= level)
		{
			grade++;
		}
	}
	return grade;
}

function add_dict2_to_dict1(dict1,dict2)
{
	for (var dict2_key in dict2)
	{
		var dict2_val = dict2[dict2_key];
		if (dict1[dict2_key] == null)
		{
			dict1[dict2_key] = dict2_val;
		}
		else
		{
			dict1[dict2_key] = dict1[dict2_key] + dict2_val;
		}
	}
}

function has_bad(arr)
{
	if (arr == null || arr.length === 0) return false;

	for (var i = 0; i < arr.length; i++)
	{
		if (seems_bad(arr[i]) == true) return true;
	}
	return false;
}

function seems_bad(x)
{
	if (x === null) return true;
	if (typeof x === 'undefined') return true;
	if (typeof x === 'object')
	{
		if (x.constructor === Array && x.length === 0) return true;
		if (x.constructor === Object && Object.keys(x).length === 0) return true;
	}
	return false;
}

function base_log(x, y)
{
	return Math.log(y) / Math.log(x);
}