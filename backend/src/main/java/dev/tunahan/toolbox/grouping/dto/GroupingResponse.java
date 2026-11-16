package dev.tunahan.toolbox.grouping.dto;

import dev.tunahan.toolbox.grouping.Grouping;

import java.util.ArrayList;
import java.util.List;

public record GroupingResponse(String id,
                               String title,
                               int groupSize,
                               List<GroupDto> groups,
                               int totalGroups,
                               int totalParticipants,
                               Integer repeatConflictPenalty) {

    public record GroupDto(int groupId, List<String> members) {}

    public static GroupingResponse from(Grouping grouping) {
        List<GroupDto> groups = new ArrayList<>();
        for (int i = 0; i < grouping.getGroups().size(); i++) {
            groups.add(new GroupDto(i + 1, grouping.getGroups().get(i)));
        }

        int participants = 0;
        for (List<String> group : grouping.getGroups()) {
            participants += group.size();
        }

        return new GroupingResponse(
                grouping.getId(),
                grouping.getTitle(),
                grouping.getGroupSize(),
                groups,
                groups.size(),
                participants,
                null
        );
    }
}