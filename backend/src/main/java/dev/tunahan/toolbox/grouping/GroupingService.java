package dev.tunahan.toolbox.grouping;


import dev.tunahan.toolbox.common.BadRequestException;
import dev.tunahan.toolbox.common.NotFoundException;
import dev.tunahan.toolbox.grouping.dto.CreateGroupingRequest;
import dev.tunahan.toolbox.grouping.dto.GroupingResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class GroupingService {
    private static final String DEFAULT_TITLE = "İsimsiz etkinlik";
    private static final String ID_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
    private static final int ID_LENGTH = 6;

    private final GroupingRepository repository;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public GroupingResponse create(CreateGroupingRequest request) {
    List<String> names = request.names().stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(name -> !name.isEmpty())
            .toList();

        if (names.size() < 2){
            throw new BadRequestException("En az 2 isim girilmeli");
        }
        String title = (request.title() == null || request.title().isBlank())
                ? DEFAULT_TITLE
                : request.title().trim();

        Grouping grouping = new Grouping();
        grouping.setId(generateUniqueId());
        grouping.setTitle(title);
        grouping.setGroupSize(request.groupSize());
        grouping.setGroups(makeGroups(names,request.groupSize()));
        return GroupingResponse.from(repository.save(grouping));
        }

        @Transactional(readOnly = true)
        public GroupingResponse get(String id){
        return repository.findById(id)
                .map(GroupingResponse::from)
                .orElseThrow(() -> new NotFoundException("Grup bulunamadı " + id));
        }

    List<List<String>> makeGroups(List<String> names, int groupSize) {
        List<String> shuffled = new ArrayList<>(names);
        Collections.shuffle(shuffled, random);

        int groupCount = shuffled.size() / groupSize;
        int remainder = shuffled.size() % groupSize;
        if (remainder >= 2 || groupCount == 0) {
            groupCount++;
        }

        List<List<String>> groups = new ArrayList<>();
        for (int i = 0; i < groupCount; i++) {
            groups.add(new ArrayList<>());
        }

        for (int i = 0; i < shuffled.size(); i++) {
            groups.get(i % groupCount).add(shuffled.get(i));
        }
        return groups;
    }

    private String generateUniqueId() {
        String id;
        do {
            StringBuilder sb = new StringBuilder(ID_LENGTH);
            for (int i = 0; i < ID_LENGTH; i++) {
                sb.append(ID_CHARS.charAt(random.nextInt(ID_CHARS.length())));
            }
            id = sb.toString();
        } while (repository.existsById(id));
        return id;
    }

    }
