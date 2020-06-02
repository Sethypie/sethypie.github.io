load_code('Helper');
load_code('PartyCommands');
load_code('CombatSkills');
load_code('ItemEnhancement');

map_key("0","snippet","clean_all_screens();")

var hunted_monster = 'arcticbee';
var hunted_monster_area = get_best_area_for_monster(hunted_monster);
var primary_monster = null;
var attack_mode = true;

if (character.ctype == 'ranger')
{
	add_combat_skill('huntersmark','debuff',1);
	add_combat_skill('5shot','attack',5);
	add_combat_skill('3shot','attack',3);
	add_combat_skill('supershot','attack',1);
	add_combat_skill('attack','attack',1);
	add_combat_skill('piercingshot','attack',1);
}
else if (character.ctype == 'mage')
{
	add_combat_skill('energize','buff',1);
	add_combat_skill('attack','attack',1);
}
else if (character.ctype == 'merchant')
{
	attack_mode = false;
	load_code('Merchant');
}

async function attempt_respawn()
{
	game_log('Respawning...');
	await sleep(15000);
	respawn();
	await sleep(1000);
}

function is_in_combat()
{
	if (primary_monster==null) return false;
	else if (primary_monster.dead==true) return false;
	else if (primary_monster.visible==false) return false;
	return true;
}

async function go_to_hunted_monster_area()
{
	var map = hunted_monster_area.map;
	var x = hunted_monster_area.center.x;
	var y = hunted_monster_area.center.y;
	
	var d = distance_to(x,y);
	if (d == null || d > 300)
	{
		await smart_move({map:map,x:x,y:y});
	}
}

async function setup_shop()
{
	const shop_location = {map:'main',x:-61.78,y:-115.85};
	if (distance(character,shop_location) < 5 && character.standed != null)
	{
		return; // Seems like the shop is already setup.
	}
	
	await close_shop();
	if (distance(character,shop_location) > 250)
	{
		await use_skill('use_town');
		await sleep(6000);
	}
	await smart_move(shop_location);
	await sleep(250);
	await smart_move(character.x,character.y+1);
	await sleep(250);
	await open_shop();
}

async function battle_move()
{
	if (is_in_combat() == false) move(character.real_x,character.real_y);
		
	primary_monster = get_closest_threat();
	if (primary_monster == null)
	{
		primary_monster = get_nearest_monster({type:hunted_monster});
	}
	change_target(primary_monster);
	
	if (character.moving == true) return;

	// Determine possible kite locations.
	var m_range = primary_monster.range;
	var m_x = primary_monster.x;
	var m_y = primary_monster.y;
	var desired_distance = min(m_range+35,character.range);
	
	var kite_locations = [], multipliers = [-1,0,1];
	for (var i = 0; i < multipliers.length; i++)
	{
		for (var j = 0; j < multipliers.length; j++)
		{
			var x_multi = multipliers[i];
			var y_multi = multipliers[j];
			if (x_multi == 0 && y_multi == 0) continue;
			var new_x = m_x + (x_multi * desired_distance);
			var new_y = m_y + (y_multi * desired_distance);
			kite_locations.push({x:new_x,y:new_y});
		}
	}
	
	var zone_x = hunted_monster_area.center.x;
	var zone_y = hunted_monster_area.center.y;
	var char_to_zone_d = distance_to(zone_x,zone_y);
	var dist_from_x = null, dist_from_y = null; 
	
	// If drifted too far from zone center, avoid going further away.
	if (char_to_zone_d > 150)
	{
		var valid_spots = [];
		for (var i = 0; i < kite_locations.length; i++)
		{
			var kite_loc = kite_locations[i];
			var d = calc_distance(kite_loc.x,kite_loc.y,zone_x,zone_y);
			if (d <= char_to_zone_d)
			{
				valid_spots.push(kite_loc);
			}
		}
		kite_locations = valid_spots;
	}

	// Out of the valid locations, go to the closest one.
	var ideal_location = null, min_distance = null;
	for (var i = 0; i < kite_locations.length; i++)
	{
		var kite_loc = kite_locations[i];
		if (!can_move(kite_loc.x,kite_loc.y)) continue;
		var d = calc_distance(character.x,character.y,kite_loc.x,kite_loc.y);
		if (ideal_location == null)
		{
			ideal_location = kite_loc;
			min_distance = d;
		}
		else if (d < min_distance)
		{
			ideal_location = kite_loc;
			min_distance = d;
		}
	}
	move(ideal_location.x,ideal_location.y);
}

function get_closest_threat()
{
	var threat_ent = null, threat_distance = null;
	for (var ent_id in parent.entities)
	{
		var next_ent = parent.entities[ent_id];
		if (next_ent.target == character.name && next_ent.mtype != null)
		{
			var new_threat_d = distance(character,next_ent);
			if (threat_ent == null)
			{
				threat_ent = next_ent;
				threat_distance = new_threat_d;
			}
			else if (new_threat_d < threat_distance)
			{
				threat_ent = next_ent;
				threat_distance = new_threat_d;
			}
		}
	}
	return threat_ent;
}

async function main_loop()
{
	try
	{
		if (character.rip)
		{
			await attempt_respawn();
		}
		
		if (character.party == null)
		{
			join_the_party();
		}

		if (attack_mode == true)
		{
			if (is_in_combat() == false)
			{
				await go_to_hunted_monster_area();
			}
			use_hp_or_mp_pots();
			loot();
			battle_move();
			await use_next_combat_skill();
		}
		else
		{
			if (character.ctype == 'merchant')
			{
				if (character.walking != null)
				{
					await close_shop();	
				}
				await auto_enhance();
				await bank_items();
				await potion_run();
				await setup_shop();
			}
		}
	}
	catch(err)
	{
		console.log(err);
		game_log(err);
	}

	// Loop every 250ms
	setTimeout(async () => { this.main_loop() }, 250)
}

main_loop();
