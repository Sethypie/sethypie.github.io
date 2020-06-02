// Collect game data for class skills.
var class_skill_details = {};
for (var skill_id in G.skills)
{
	var skill = G.skills[skill_id];
	if (skill.class == null || skill.class == character.ctype)
	{
		var skill_details = {};
		skill_details.id = skill_id;
		skill_details.name = skill.name;
		skill_details.cooldown = skill.cooldown;
		skill_details.mp = skill.mp || 0;
		skill_details.level = skill.level || 0;
		skill_details.range = skill.range;
		skill_details.range_bonus = skill.range_bonus || 0;
		skill_details.range_multiplier = skill.range_multiplier || 1;
		skill_details.last_used = Date.now();
		class_skill_details[skill_id] = skill_details;
	}
}
class_skill_details['attack'].mp = G.classes[character.ctype].mp_cost;

// Control which combat skills are used, and the order to use them in.
var combat_skill_rotation = [];
var combat_skill_rotation_index = 0;
function add_combat_skill(id_in,type_in,num_targets_in)
{
	var skill_details = class_skill_details[id_in];
	if (skill_details != null)
	{
		var combat_skill = {};
		combat_skill.id = id_in;
		combat_skill.type = type_in;
		combat_skill.details = skill_details;
		combat_skill.num_targets = num_targets_in;
		combat_skill_rotation.push(combat_skill);
	}
	else
	{
		game_log("Warning: combat skill " + id_in + " could not be added!");
	}
}

function get_next_skill_from_rotation()
{
	var next_skill = combat_skill_rotation[combat_skill_rotation_index];
	combat_skill_rotation_index =
		(combat_skill_rotation_index + 1) % combat_skill_rotation.length;
	return next_skill;
}

function reset_skill_rotation()
{
	combat_skill_rotation_index = 0;
}

async function use_next_combat_skill()
{
	if (combat_skill_rotation == null || combat_skill_rotation.length == 0)
	{
		return;	
	}
	
	// Use the next usable skill in the rotation.
	// TO-DO: Not sure if I should use a dynamic rotation or queue.
	for (var combat_skill_index in combat_skill_rotation)
	{
		var combat_skill = combat_skill_rotation[combat_skill_index];
		var combat_skill_used = false;
		if (combat_skill.type == 'attack')
		{
			if (skill_is_usable(combat_skill.details, primary_monster) == true)
			{
				if (combat_skill.id == 'attack')
				{
					attack(primary_monster);
					combat_skill_used = true;
				}
				else
				{
					use_skill(combat_skill.id,primary_monster);
					combat_skill_used = true;
				}
			}
		}
		else if (combat_skill.type == 'buff')
		{
			if (combat_skill.id == 'energize')
			{
				var t = get_friendly_target({attr:'percent_mp',f_type:'min'});
				var missing_mana = t.max_mp - t.mp;
				var mana_to_gift = min(missing_mana, (character.mp/2));
				use_skill(combat_skill.id,t.id,mana_to_gift);
				combat_skill_used = true;
			}
		}
		
		if (combat_skill_used == true)
		{
			combat_skill.details.last_used = Date.now();
		}
	}
}

// filters should be an array of {attr,f_type,f_val}.
// if using multiple filters, remember order matters!
function get_friendly_target(filters)
{
	var party_info = get_party_info();
	
	if (filters != null && filters.length > 0)
	{
		for (var i = 0; i < filters.length; i++)
		{
			var attr = filters[i].attr;
			var f_type = filters[i].f_type;
			var f_val = filters[i].f_val;
			party_info = filter_dict_by_subkey(party_info,attr,f_type,f_val);
		}
	}
	
	var friendly_target = null;
	for (var friendly_id in party_info)
	{
		var friendly = party_info[friendly_id];
		if (friendly != null)
		{
			friendly_target = friendly;
			break;
		}
	}
	return friendly_target;
}

// Usage: supply a subkey, filter type, and filter value (optional).
// Filters dictionaries within dictionaries.
function filter_dict_by_subkey(dict,subkey,filter_type,filter_val)
{
	var dict_as_arr = [];
	for (var key in dict)
	{
		var value = dict[key][subkey];
		if (value == null)
		{
			continue;
		}
		else
		{
			dict_as_arr.push({key:key,value:value});
		}
	}
	
	var filter_func = null;
	var filtered_arr = null;
	if (dict_as_arr.length > 0)
	{
		if (filter_type == 'min')
		{
			filter_val = dict_as_arr[0].value;
			for (var i = 1; i < dict_as_arr.length; i++)
			{
				filter_val = min(filter_val,dict_as_arr[i].value);
			}
			var filter_func = function(item) {return item.value == filter_val;}
		}
		else if (filter_type == 'max')
		{
			filter_val = dict_as_arr[0].value;
			for (var i = 1; i < dict_as_arr.length; i++)
			{
				filter_val = max(filter_val,dict_as_arr[i].value);
			}
			var filter_func = function(item) {return item.value == filter_val;}
		}
		else if (filter_type == 'equal')
		{
			var filter_func = function(item) {return item.value == filter_val;}
		}
		else if (filter_type == 'greater_than')
		{
			var filter_func = function(item) {return item.value > filter_val;}
		}
		else if (filter_type == 'equal_or_greater_than')
		{
			var filter_func = function(item) {return item.value >= filter_val;}
		}
		else if (filter_type == 'less_than')
		{
			var filter_func = function(item) {return item.value < filter_val;}
		}
		else if (filter_type == 'equal_or_less_than')
		{
			var filter_func = function(item) {return item.value <= filter_val;}	
		}
	
		filtered_arr = dict_as_arr.filter(filter_func);
	}
	var filtered_dict = {};
	for (var i = 0; i < filtered_arr.length; i++)
	{
		var item = filtered_arr[i];
		filtered_dict[item.key] = dict[item.key];
	}
	return filtered_dict;
}

function get_party_info()
{
	var party_info = {};
	for (var party_member_id in get_party())
	{
		var entity_details = parent.entities[party_member_id];
		if (entity_details == null) continue;
		var info = {};
		info.id = party_member_id;
		info.x = entity_details.x;
		info.y = entity_details.y;
		info.visible = entity_details.visible;
		info.hp = entity_details.hp;
		info.max_hp = entity_details.max_hp;
		info.percent_hp = entity_details.hp / entity_details.max_hp;
		info.mp = entity_details.mp;
		info.max_mp = entity_details.max_mp;
		info.mp = entity_details.mp;
		info.percent_mp = entity_details.mp / entity_details.max_mp;
		info.ctype = entity_details.ctype;
		party_info[party_member_id] = info;
	}
	var self_info = {};
	self_info.id = character.id;
	self_info.x = character.x;
	self_info.y = character.y;
	self_info.visible = character.visible;
	self_info.hp = character.hp;
	self_info.max_hp = character.max_hp;
	self_info.percent_hp = floor(character.hp / character.max_hp) * 100;
	self_info.mp = character.mp;
	self_info.max_mp = character.max_mp;
	self_info.percent_mp = floor(character.mp / character.max_mp) * 100;
	self_info.ctype = character.ctype;
	party_info[character.id] = self_info;
	return party_info;
}

function skill_is_usable(skill_details,skill_target)
{	
	if (!skill_details || !skill_target || !skill_target.visible)
	{
		return false;
	}
	else if (character.level < skill_details.level)
	{
		return false;
	}
	else if (character.mp < skill_details.mp)
	{
		return false;
	}
	else if (is_on_cooldown(skill_details.id))
	{
		return false;
	}
	else if(skill_details.cooldown != null)
	{
		// Secondary cooldown check incase server hasn't
		// provide an updated last_used value yet.
		var estimate = (skill_details.last_used + skill_details.cooldown + 50);
		if (estimate > Date.now)
		{
			return false;
		}
	}
	
	var distance_to_target = distance(character, skill_target);
	var effective_range = (skill_details.range*skill_details.range_multiplier)+skill_details.range_bonus;
	if (distance_to_target > effective_range)
	{
		game_log('Out of range');
		return false;
	}
	return true;
}