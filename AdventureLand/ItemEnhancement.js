var last_session_time = null;
var craft_delay = 1000*60*45;
const upgrade_location = {map:'main',x:-323.32,y:-77.08};
const enhancement_dict =
	{
		wcap:7,
		bow:7,
		wshoes:7,
		slimestaff:7,
		cclaw:7,
		quiver:7,
		hbow:7,
		hpamulet:3,
		ringsj:3,
		hpbelt:3,
		wattire:7,
		strring:4,
		intring:4,
		dexring:4,
		vitring:4
	};

// Populate useful lookup dictionaries.
const grade_for_uscroll = {};
const grade_for_cscroll = {};
const upgradeable_item_grades = {};
const compoundable_item_grades = {};
for (item_id in G.items)
{
	var item = G.items[item_id];
	if (item.type == 'uscroll')
	{
		grade_for_uscroll[item.grade] = item_id;
	}
	else if (item.type == 'cscroll')
	{
		grade_for_cscroll[item.grade] = item_id;
	}
	else if (item.upgrade != null && item.grades != null)
	{
		upgradeable_item_grades[item_id] = item.grades;
	}
	else if (item.compound != null && item.grades != null)
	{
		compoundable_item_grades[item_id] = item.grades;
	}
}

function trim_requirements_for_slots(scrolls_required)
{
	var scroll_slots_needed = {};
	for (var scroll_category in scrolls_required)
	{
		var scroll_category_required = scrolls_required[scroll_category];
		if (scroll_category_required == null) continue;
		
		var grade_for_scroll = null;
		if (scroll_category == 'uscrolls')
		{
			grade_for_scroll = grade_for_uscroll;
		}
		else if (scroll_category == 'cscrolls')
		{
			grade_for_scroll = grade_for_cscroll;
		}

		for (var grade in scroll_category_required)
		{
			var scroll_type = grade_for_scroll[grade];
			if (locate_item(scroll_type) == -1)
			{
				var amount = scroll_category_required[grade];
				var info = {};
				info.scroll_category = scroll_category;
				info.amount = amount;
				info.grade = grade;
				info.scroll_type = scroll_type;
				scroll_slots_needed[scroll_type] = info;
			}
		}
	}
	
	var free_slots_needed = Object.keys(scroll_slots_needed).length;
	var free_slots_available = get_free_slots_available();
	var num_scrolls_to_trim = free_slots_needed - free_slots_available;
	for (var i = 0; i < num_scrolls_to_trim; i++)
	{
		var removed_scroll = null;
		for (var scroll_type in scroll_slots_needed)
		{
			var scroll_info = scroll_slots_needed[scroll_type];
			if (scroll_info == null) continue;
			if (removed_scroll == null || scroll_info.grade > removed_scroll.grade)
			{
				removed_scroll = scroll_info;
			}
			else if (scroll_info.grade == removed_scroll.grade)
			{
				if (removed_scroll.amount > scroll_info.amount)
				{
					removed_scroll = scroll_info;
				}
			}
		}
		var rs = removed_scroll;
		delete scrolls_required[rs.scroll_category][rs.grade];
		delete scroll_slots_needed[rs.scroll_type];
	}
}

async function auto_enhance()
{
	if (last_session_time == null || Date.now() > last_session_time + craft_delay)
	{
		await close_shop();
		game_log('Beginning crafting session.');
	}
	else
	{
		return;
	}
	
	var scrolls_required = get_all_required_scrolls();
	if (seems_bad(scrolls_required)) return; // Nothing to upgrade.
	
	trim_requirements_for_slots(scrolls_required);
	if (seems_bad(scrolls_required)) return; // No space to upgrade.

	await smart_move(upgrade_location);
	await buy_required_scrolls(scrolls_required);
	
	var enhancing = true;
	while (enhancing)
	{
		var item_enhanced = false;
		for (var item_index = 0; item_index < character.items.length; item_index++)
		{
			var item = character.items[item_index];
			if (item == null) continue;
			var item_id = item.name;
			var target_level = enhancement_dict[item_id];
			if (target_level == null || item.level >= target_level) continue;
			
			if (upgradeable_item_grades[item_id] != null)
			{
				var grade = get_item_grade(item_id,item.level);
				var scroll_type = grade_for_uscroll[grade];
				var scroll_location = locate_item(scroll_type);
				if (scroll_location > 0)
				{
					game_log('Upgrading ' + item_id);
					await upgrade(item_index,scroll_location);
					item_enhanced = true;
				}
			}
			else if (compoundable_item_grades[item_id] != null)
			{
				var similar_items = [item_index,];
				for (var j = item_index+1; j < character.items.length; j++)
				{
					var other_item = character.items[j];
					if (other_item == null) continue;
					if (other_item.name != item_id) continue;
					if (other_item.level != item.level) continue;
					similar_items.push(j);
					if (similar_items.length >= 3) break;
				}
				
				if (similar_items.length == 3)
				{
					var grade = get_item_grade(item_id,item.level);
					var scroll_type = grade_for_cscroll[grade];
					var scroll_location = locate_item(scroll_type);
					var ind = similar_items;
					if (scroll_location != -1)
					{
						game_log('Compounding ' + item_id);
						await compound(ind[0],ind[1],ind[2],scroll_location);
						item_enhanced = true;
					}
				}
			}
		}
		enhancing = item_enhanced;
	}
	last_session_time = Date.now();
}

async function buy_required_scrolls(scrolls_required)
{
	for (var grade in scrolls_required.uscrolls)
	{
		var scroll_type = grade_for_uscroll[grade];
		var amount = scrolls_required.uscrolls[grade];
		await sn_buy(scroll_type,{max:amount});
	}
	
	for (var grade in scrolls_required.cscrolls)
	{
		var scroll_type = grade_for_cscroll[grade];
		var amount = scrolls_required.cscrolls[grade];
		await sn_buy(scroll_type,{max:amount});
	}
}

function get_all_required_scrolls()
{
	var improvable_items = get_improvable_items();
	var upgradeable_items = improvable_items.upgradeable;
	var uscrolls_required = get_all_required_uscrolls(upgradeable_items);

	var compoundable_items = improvable_items.compoundable;
	var cscrolls_required = get_all_required_cscrolls(compoundable_items);

	var scrolls_required = {};
	scrolls_required.uscrolls = uscrolls_required;
	scrolls_required.cscrolls = cscrolls_required;
	return scrolls_required;
}

// Simulate the compounding process to determine the scroll costs.
function get_all_required_cscrolls(compoundable_items)
{
	var c_scrolls_required = {};
	var curr_compounding = compoundable_items;
	var is_compounding = true;
	while (is_compounding)
	{
		var next_compounding = {};
		var did_compounding = false;
		for (var item_id in curr_compounding)
		{
			var target_level = enhancement_dict[item_id];
			if (target_level == null) continue;
			for (var item_level in curr_compounding[item_id])
			{
				if (item_level >= target_level) continue;
				
				// Determine results of compounding..
				var item_quant = curr_compounding[item_id][item_level];
				var num_compounds = floor(item_quant / 3);
				var num_remaining = item_quant - (num_compounds * 3);
				
				// Determine the scrolls required for this session.
				var grade = get_item_grade(item_id,item_level);
				var item_cscrolls_req = {};
				item_cscrolls_req[grade] = num_compounds;
				add_dict2_to_dict1(c_scrolls_required,item_cscrolls_req);
				
				// Update item amounts for the next session.
				var next_dict = {}
				if (num_remaining > 0)
				{
					next_dict[item_level] = num_remaining;
				}
				if (num_compounds > 0)
				{
					next_dict[item_level+1] = num_compounds;
					did_compounding = true;
				}
				if (next_compounding[item_id] == null)
				{
					if (!seems_bad(next_dict))
					{
						next_compounding[item_id] = next_dict;
					}
				}
				else
				{
					add_dict2_to_dict1(next_compounding[item_id],next_dict);
				}
			}
		}
		curr_compounding = next_compounding;
		is_compounding = did_compounding;
	}
	return c_scrolls_required;
}

function get_all_required_uscrolls(upgradeable_items)
{
	var u_scrolls_required = {};
	for (var item_id in upgradeable_items)
	{
		var target_level = enhancement_dict[item_id];
		if (target_level == null) continue;
		for (var item_level in upgradeable_items[item_id])
		{
			var u_req = get_uscrolls_required(item_id,item_level,target_level);
			if (seems_bad(u_req)) continue;
			var item_quant = upgradeable_items[item_id][item_level];
			if (item_quant > 1)
			{
				for (var grade_key in u_req)
				{
					u_req[grade_key] = u_req[grade_key] * item_quant;
				}
			}
			add_dict2_to_dict1(u_scrolls_required,u_req);
		}
	}
	return u_scrolls_required;
}

// Upgrading is straight forward enough to take some math shortcuts.
function get_uscrolls_required(item_id,current_level,target_level)
{
	if (has_bad([item_id,current_level,target_level])) return -1;
	if (current_level >= target_level) return {};
	var item = G.items[item_id];
	if (has_bad([item,item.grades])) return -1;
	
	var required_scrolls = {};
	var grade_level = 0, previous_cutoff = 0;
	while (grade_level < item.grades.length)
	{
		var grade_cutoff = item.grades[grade_level];
		if (grade_cutoff < current_level)
		{
			previous_cutoff = grade_cutoff;
			grade_level++;
			continue;
		}
		else if (grade_cutoff > target_level)
		{
			break;
		}
		var start_interval = max(current_level,previous_cutoff);
		var end_interval = min(grade_cutoff,target_level);
		var interval_size = (end_interval - start_interval);
		if (interval_size > 0)
		{
			required_scrolls[grade_level] = interval_size;
		}
		previous_cutoff = grade_cutoff;
		grade_level++;
	}
	var start_interval = max(current_level,previous_cutoff);
	if (target_level > start_interval)
	{
		required_scrolls[grade_level] = (target_level - start_interval);
	}
	
	return required_scrolls;
}

function get_improvable_items()
{
	var upgradeable_items = {};
	var compoundable_items = {};
	for (var item_index = 0; item_index < character.items.length; item_index++)
	{
		var item = character.items[item_index];
		if (item == null) continue;
		var item_id = item.name;
		var dict_num_of_level = {};
		dict_num_of_level[item.level] = item.q || 1;
		
		var dict_to_update = null;
		if (upgradeable_item_grades[item_id] != null)
		{
			dict_to_update = upgradeable_items;
		}
		else if (compoundable_item_grades[item_id] != null)
		{
			dict_to_update = compoundable_items;
		}
		
		if (dict_to_update == null) continue;
		if (dict_to_update[item_id] == null)
		{
			dict_to_update[item_id] = dict_num_of_level;
		}
		else
		{
			add_dict2_to_dict1(dict_to_update[item_id],dict_num_of_level);
		}
	}

	var improvable_items = {};
	improvable_items.compoundable = compoundable_items;
	improvable_items.upgradeable = upgradeable_items;
	return improvable_items;
}